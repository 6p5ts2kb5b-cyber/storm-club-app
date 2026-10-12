// ============================================================
// 「ひとこと入力」を読み取って、活動日のフォームに入れる中身を作る（計算だけ・AIは使いません）
// 例：「11.3 審判2名必要 審判7:30集合 生徒7:00 1試合目9:00開始」
// 全角・半角どちらでも読み取れます。保存はしません（フォームに入れるだけ）。
// ============================================================

import type { Division } from "./divisions";

export interface QuickUnit {
  activityType?: string;
  venue?: string;
  /** 選手（生徒）集合 "07:00" */
  gatherTime?: string;
  /** 審判集合 "07:30" */
  umpireGatherTime?: string;
  /** 審判の人数（0 = 不要） */
  umpireNeeded?: number;
  /** 1試合目の開始 "09:00" */
  firstGameStart?: string;
  /** 指導者（スタッフの名前の一部） */
  coachWords?: string[];
}

export interface QuickResult {
  date?: string;
  /** トップ／アカデミーの言葉があったか */
  split: boolean;
  common: QuickUnit;
  byDivision: Partial<Record<Division, QuickUnit>>;
  /** 読み取った内容の説明（画面に出す） */
  notes: string[];
  /** 読み取れなかった時刻など（画面に出す） */
  ignored: string[];
}

const TYPES = ["練習試合", "公式戦", "大会", "練習", "その他"];

/** 全角→半角にそろえる（数字・コロン・スラッシュ・ピリオドなど） */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[~～]/g, "〜")
    .replace(/[　]/g, " ");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD"。今日から30日以上過ぎた日付は、来年として扱う */
function makeDate(month: number, day: number, today: string): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const y = Number(today.slice(0, 4));
  const t = Date.parse(`${today}T00:00:00Z`);
  let cand = `${y}-${pad2(month)}-${pad2(day)}`;
  if (Date.parse(`${cand}T00:00:00Z`) < t - 30 * 86400000) cand = `${y + 1}-${pad2(month)}-${pad2(day)}`;
  const d = new Date(`${cand}T00:00:00Z`);
  if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return undefined; // 2/30 など
  return cand;
}

// 時刻：7:00 / 7時 / 7時30分 / 7時半
const TIME_RE = /(\d{1,2})(?:[:：](\d{2})|時(?:(\d{1,2})分?|(半))?)/g;

function timeValue(m: RegExpExecArray): string | undefined {
  const h = Number(m[1]);
  const min = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined ? Number(m[3]) : m[4] ? 30 : 0;
  if (h > 23 || min > 59) return undefined;
  return `${pad2(h)}:${pad2(min)}`;
}

function readUnit(text: string): { unit: QuickUnit; ignored: string[] } {
  const unit: QuickUnit = {};
  const ignored: string[] = [];

  const type = TYPES.find((t) => text.includes(t));
  if (type) unit.activityType = type;

  const need = text.match(/審判\s*(\d)\s*(?:名|人)/);
  if (need) unit.umpireNeeded = Number(need[1]);
  else if (/審判\s*(?:なし|不要|無し|いらない)/.test(text)) unit.umpireNeeded = 0;

  const venue = text.match(/(?:会場|場所)\s*[:：は]?\s*([^\s、,。]+)/);
  if (venue) unit.venue = venue[1];

  const coach = text.match(/(?:指導者|コーチ)\s*[:：は]?\s*([^。\n]+)/);
  if (coach) {
    const words = coach[1]
      .split(/[\s、,・と]+/)
      .map((w) => w.replace(/先生|さん|コーチ/g, "").trim())
      .filter((w) => w && !/\d|集合|開始|審判|生徒|選手|会場/.test(w));
    if (words.length) unit.coachWords = words;
  }

  // 時刻ごとに、何の時刻かを前後の言葉から決める
  const times = [...text.matchAll(TIME_RE)];
  let prevEnd = 0;
  const unlabeled: string[] = [];
  for (let i = 0; i < times.length; i++) {
    const m = times[i] as unknown as RegExpExecArray & { index: number };
    const value = timeValue(m);
    const start = m.index;
    const end = start + m[0].length;
    const nextStart = i + 1 < times.length ? (times[i + 1].index as number) : text.length;
    // 前の文字：区切り（、，。改行）か前の時刻のあとから
    let before = text.slice(prevEnd, start);
    const cut = Math.max(before.lastIndexOf("、"), before.lastIndexOf(","), before.lastIndexOf("。"), before.lastIndexOf("\n"));
    if (cut >= 0) before = before.slice(cut + 1);
    let after = text.slice(end, nextStart);
    const cut2 = after.search(/[、,。\n]/);
    if (cut2 >= 0) after = after.slice(0, cut2);
    prevEnd = end;
    if (!value) continue;

    const label = m[0];
    const beforeTail = before.slice(-12).replace(/練習試合|公式戦/g, "");
    const afterHead = after.slice(0, 8);
    if (/試合|第\d/.test(beforeTail) || /^\s*(?:から)?\s*(?:開始|スタート|プレイボール)/.test(afterHead)) {
      const no = beforeTail.match(/(\d)\s*試合目|第\s*(\d)\s*試合/);
      const n = no ? Number(no[1] ?? no[2]) : 1;
      if (n === 1) unit.firstGameStart = value;
      else ignored.push(`${n}試合目 ${label}`);
    } else if (/(生徒|選手|子ども|子供)\s*(?:は|の)?\s*(?:集合)?\s*$/.test(beforeTail) || /^\s*(?:の)?(生徒|選手|子ども|子供)/.test(afterHead)) {
      unit.gatherTime = value;
    } else if (/審判[^、,。]*$/.test(beforeTail) || /^\s*(?:の)?審判/.test(afterHead)) {
      unit.umpireGatherTime = value;
    } else if (/^\s*(?:に)?集合/.test(afterHead)) {
      unlabeled.push(value);
    } else {
      ignored.push(label);
    }
  }
  // 「7:00集合」だけのときは、審判が必要なら審判集合、そうでなければ選手集合
  for (const v of unlabeled) {
    const umpire = (unit.umpireNeeded ?? 0) > 0 || /審判/.test(text);
    if (umpire && !unit.umpireGatherTime) unit.umpireGatherTime = v;
    else if (!unit.gatherTime) unit.gatherTime = v;
    else ignored.push(v);
  }
  return { unit, ignored };
}

export function parseQuick(raw: string, today: string): QuickResult {
  let text = normalizeText(raw);
  const result: QuickResult = { split: false, common: {}, byDivision: {}, notes: [], ignored: [] };

  // 日付：11月3日 / 11/3 / 11.3（時刻より先に取り出して、本文から外す）
  const dm = text.match(/(?<![\d:])(\d{1,2})\s*月\s*(\d{1,2})\s*日?/) ?? text.match(/(?<![\d:.\/])(\d{1,2})\s*[\/.]\s*(\d{1,2})(?![\d:.\/])/);
  if (dm && dm.index !== undefined) {
    result.date = makeDate(Number(dm[1]), Number(dm[2]), today);
    if (result.date) text = text.slice(0, dm.index) + " " + text.slice(dm.index + dm[0].length);
  }

  // トップ／アカデミーで分けて書かれているとき
  const marks = [...text.matchAll(/トップ|アカデミー/g)];
  if (marks.length === 0) {
    const r = readUnit(text);
    result.common = r.unit;
    result.ignored.push(...r.ignored);
  } else {
    result.split = true;
    const head = readUnit(text.slice(0, marks[0].index));
    result.common = head.unit;
    result.ignored.push(...head.ignored);
    marks.forEach((m, i) => {
      const seg = text.slice((m.index as number) + m[0].length, i + 1 < marks.length ? (marks[i + 1].index as number) : text.length);
      const r = readUnit(seg);
      const d: Division = m[0] === "トップ" ? "top" : "academy";
      result.byDivision[d] = { ...(result.byDivision[d] ?? {}), ...r.unit };
      result.ignored.push(...r.ignored);
    });
  }

  // 読み取れた内容の説明
  const describe = (u: QuickUnit, prefix = "") => {
    const out: string[] = [];
    if (u.activityType) out.push(`${prefix}活動内容 ${u.activityType}`);
    if (u.venue) out.push(`${prefix}会場 ${u.venue}`);
    if (u.gatherTime) out.push(`${prefix}選手集合 ${u.gatherTime.replace(/^0/, "")}`);
    if (u.umpireNeeded !== undefined) out.push(`${prefix}審判 ${u.umpireNeeded > 0 ? `${u.umpireNeeded}名` : "不要"}`);
    if (u.umpireGatherTime) out.push(`${prefix}審判集合 ${u.umpireGatherTime.replace(/^0/, "")}`);
    if (u.firstGameStart) out.push(`${prefix}1試合目 ${u.firstGameStart.replace(/^0/, "")}開始`);
    if (u.coachWords?.length) out.push(`${prefix}指導者 ${u.coachWords.join("・")}`);
    return out;
  };
  if (result.date) result.notes.push(`日付 ${Number(result.date.slice(5, 7))}月${Number(result.date.slice(8))}日`);
  result.notes.push(...describe(result.common));
  if (result.byDivision.top) result.notes.push(...describe(result.byDivision.top, "トップ："));
  if (result.byDivision.academy) result.notes.push(...describe(result.byDivision.academy, "アカデミー："));
  return result;
}
