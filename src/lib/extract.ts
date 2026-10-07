// ============================================================
// 写真・PDF・音声から読み取った「予定の下書き」の形と、整え方
// サーバー（読み取り）と画面（確認・手直し）の両方で使います。
// ============================================================

import { autoModeForDate, type Division } from "./divisions";
import { MAX_UMPIRES } from "./status";

export const ACTIVITY_CHOICES = ["練習試合", "公式戦", "大会", "練習", "その他"] as const;

/** 読み取った1件（1日・1区分分） */
export interface DraftUnit {
  key: string;
  date: string; // "2026-12-05"
  division: Division;
  activityType: string;
  venue: string;
  playerGather: string; // "07:30" または ""
  umpireNeeded: number; // 0 = 不要
  umpireGather: string; // "08:00" または ""（空なら第1試合から自動計算）
  games: { start: string; opponent: string }[];
  note: string;
  /** AIが「ここは自信がない」と言った点 */
  unsure: string;
}

export interface ExtractResult {
  drafts: DraftUnit[];
  warnings: string[];
}

/** Gemini に渡す、答えの形（JSON） */
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "YYYY-MM-DD" },
          division: { type: "STRING", enum: ["storm", "top", "academy", "unknown"] },
          activity_type: { type: "STRING", enum: [...ACTIVITY_CHOICES], nullable: true },
          venue: { type: "STRING", nullable: true },
          player_gather_time: { type: "STRING", description: "HH:MM（24時間）", nullable: true },
          umpire_needed: { type: "INTEGER", nullable: true },
          umpire_gather_time: { type: "STRING", description: "HH:MM（24時間）", nullable: true },
          games: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                start_time: { type: "STRING", description: "HH:MM（24時間）", nullable: true },
                opponent: { type: "STRING", nullable: true },
              },
            },
          },
          note: { type: "STRING", nullable: true },
          unsure: { type: "STRING", nullable: true },
        },
        required: ["date", "division", "games"],
      },
    },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["days", "warnings"],
} as const;

export function buildPrompt(today: string): string {
  return `あなたは少年野球チーム「STORMクラブ」の運営スタッフの補助です。
渡された写真・PDF・音声・文章から、活動の予定を読み取って JSON で返してください。

今日は ${today}（日本時間）です。「来週の土曜」「12/5」のような書き方は、今日を基準に年を補って YYYY-MM-DD にしてください。

読み取る項目（書かれていないものは null。推測で埋めないこと）：
- date：活動日
- division：区分。「トップ」→ top、「アカデミー」→ academy、「STORM」「全体」→ storm、書かれていなければ unknown
- activity_type：練習試合／公式戦／大会／練習／その他 のどれか
- venue：会場・グラウンド（学校名など）
- player_gather_time：選手の集合時間
- umpire_needed：STORMから出す審判の人数（「審判2名」「審判員4人」など）。不要と書かれていれば 0
- umpire_gather_time：審判の集合時間が書かれていれば
- games：試合ごとの開始時間と対戦相手（第1試合から順番に）
- note：上に当てはまらない大事な連絡（持ち物、駐車場、雨天時など）を短く
- unsure：読み取りに自信がない点があれば短く（例：「日付の数字がかすれている」）

ルール：
- 時刻は 24 時間の HH:MM（例：7時半 → 07:30、午後1時 → 13:00）
- 1 日にトップとアカデミーが別々に書かれていれば、別の項目に分けてください
- 同じ日・同じ区分は 1 つにまとめてください
- 「8:00〜12:00」のように活動の時間帯だけが書かれていて集合時間が別にないときは、始まりの時刻を player_gather_time にし、時間帯（例：8:00〜12:00）を note に入れてください
- 「練習会」は 練習 にしてください
- 日付と一緒に書かれた曜日（例：11/21（日））が、実際のカレンダーの曜日と合わないときは、unsure に「11/21は土曜日です。日付か曜日が違う可能性があります」のように書いてください
- 「〇〇 or 休み」「改めて連絡」のように未確定の予定も1件として入れ、note に未確定であることを、unsure に「未確定」と書いてください
- 予定と関係ない内容は無視してください
- 予定が見つからなければ days は空にして、warnings に理由を書いてください
- warnings には、全体として気をつける点があれば日本語で短く書いてください`;
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** 全角の数字・コロンを半角に */
function half(v: string): string {
  return v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[：]/g, ":");
}

function time(v: unknown): string {
  if (typeof v !== "string") return "";
  const m = half(v.trim()).match(TIME);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

function text(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Gemini の答えを、画面で使える安全な形に整える */
export function normalize(raw: unknown): ExtractResult {
  const obj = (raw ?? {}) as { days?: unknown[]; warnings?: unknown[] };
  const warnings = (Array.isArray(obj.warnings) ? obj.warnings : []).map((w) => text(w)).filter(Boolean);
  const drafts: DraftUnit[] = [];
  const seen = new Set<string>();

  for (const [i, d] of (Array.isArray(obj.days) ? obj.days : []).entries()) {
    const r = (d ?? {}) as Record<string, unknown>;
    const ds = typeof r.date === "string" ? half(r.date.trim()) : "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(ds) && !Number.isNaN(Date.parse(ds)) ? ds : "";
    if (!date) {
      warnings.push("日付が分からない予定が1件あったため、外しました。");
      continue;
    }
    const raw = String(r.division ?? "unknown");
    let division: Division;
    if (raw === "top" || raw === "academy" || raw === "storm") division = raw;
    else if (autoModeForDate(date) === "split") {
      // 区分が書かれていない12月〜4月の予定は、空いている方（トップ → アカデミー）に入れる
      division = seen.has(`${date}-top`) ? "academy" : "top";
    } else division = "storm";
    const key = `${date}-${division}`;
    if (seen.has(key)) {
      warnings.push(`${date} の同じ区分の予定が重なっていたため、1つ目だけを残しました。`);
      continue;
    }
    seen.add(key);

    const type = text(r.activity_type, 20);
    const n = typeof r.umpire_needed === "number" ? Math.round(r.umpire_needed) : 0;
    const games = (Array.isArray(r.games) ? r.games : [])
      .slice(0, 10)
      .map((g) => {
        const x = (g ?? {}) as Record<string, unknown>;
        return { start: time(x.start_time), opponent: text(x.opponent, 40) };
      })
      .filter((g) => g.start || g.opponent);

    drafts.push({
      key: `${key}-${i}`,
      date,
      division,
      activityType: (ACTIVITY_CHOICES as readonly string[]).includes(type) ? type : games.length ? "練習試合" : "練習",
      venue: text(r.venue, 60),
      playerGather: time(r.player_gather_time),
      umpireNeeded: Math.max(0, Math.min(MAX_UMPIRES, n)),
      umpireGather: time(r.umpire_gather_time),
      games,
      note: text(r.note),
      unsure: text(r.unsure),
    });
  }

  const order: Record<Division, number> = { top: 0, academy: 1, storm: 2 };
  drafts.sort((a, b) => a.date.localeCompare(b.date) || order[a.division] - order[b.division]);
  return { drafts, warnings };
}
