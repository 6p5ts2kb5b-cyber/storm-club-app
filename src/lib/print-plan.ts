// ============================================================
// 保護者配布用「月間予定表」の中身を作る（計算だけ）
// 活動日のデータ → 印刷用の行（日付ごと・区分ごと）に並べ直します。
// ============================================================

import { DIVISION_LABEL, type Division, formatTime, weekdayIndex, weekdayLabel } from "./divisions";
import { type DaySummary, isRest, reserveText, type UnitSummary } from "./status";

/** 送り先のよく使う組み合わせ */
export const AUDIENCES: { key: string; label: string; divisions: Division[] }[] = [
  { key: "all", label: "STORM全体", divisions: ["storm", "top", "academy"] },
  { key: "top", label: "トップ", divisions: ["storm", "top"] },
  { key: "academy", label: "アカデミー", divisions: ["storm", "academy"] },
];

export type Period = "month" | "first" | "second";

export const PERIOD_LABEL: Record<Period, string> = {
  month: "1カ月",
  first: "前半（1〜15日）",
  second: "後半（16日〜末日）",
};

/** その月の最終日（2月は28/29日を自動で） */
export function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 期間の最初の日と最後の日（"2026-11-01" 形式） */
export function periodRange(year: number, month: number, period: Period): { from: string; to: string; fromDay: number; toDay: number } {
  const last = lastDayOf(year, month);
  const fromDay = period === "second" ? 16 : 1;
  const toDay = period === "first" ? 15 : last;
  return { from: `${year}-${pad(month)}-${pad(fromDay)}`, to: `${year}-${pad(month)}-${pad(toDay)}`, fromDay, toDay };
}

/** 紙の見出し：「STORM全体　2026年11月前半（1日〜15日）の活動予定」 */
export function sheetTitle(audience: string, year: number, month: number, period: Period): string {
  const { fromDay, toDay } = periodRange(year, month, period);
  const part = period === "first" ? `前半（${fromDay}日〜${toDay}日）` : period === "second" ? `後半（${fromDay}日〜${toDay}日）` : "";
  return `${audience}　${year}年${month}月${part}の活動予定`;
}

export interface PrintLine {
  k: string;
  v: string;
  strong?: boolean;
}

export interface PrintGame {
  time: string;
  text: string;
  /** STORMが出ない試合（他チーム同士） */
  others: boolean;
}

export interface PrintGroup {
  key: string;
  division: Division;
  /** 区分の札（「トップ」など）を出すか */
  showDivision: boolean;
  /** 種類（練習・練習試合…）。休みの日は「休み」 */
  title: string;
  rest: boolean;
  lines: PrintLine[];
  games: PrintGame[];
  notes: string[];
}

export interface PrintRow {
  date: string;
  day: number;
  weekday: string;
  weekend: boolean;
  sat: boolean;
  sun: boolean;
  groups: PrintGroup[];
  /** 休みだけの日（細い1行にする） */
  quiet: boolean;
}

function groupOf(u: UnitSummary, showDivision: boolean): PrintGroup {
  if (isRest(u)) {
    return {
      key: u.division,
      division: u.division,
      showDivision,
      title: "休養日",
      rest: true,
      lines: [],
      games: [],
      notes: [reserveText(u) ? `${reserveText(u)}（大会が実施されたため）` : `${u.tournamentName}が実施されるため`],
    };
  }

  const lines: PrintLine[] = [];
  const gather = [u.playerGatherTime ? formatTime(u.playerGatherTime) : "", u.gatherPlace ?? ""].filter(Boolean).join("　");
  if (gather) lines.push({ k: "集合", v: gather, strong: true });
  const place = u.venue || (u.groundState === "decided" ? u.groundName : undefined);
  if (place) lines.push({ k: "会場", v: place });

  const games: PrintGame[] = [...u.games]
    .sort((a, b) => a.no - b.no)
    .filter((g) => g.start || g.opponent || g.opponent2)
    .map((g) =>
      g.stormPlays === false
        ? {
            time: g.start ? formatTime(g.start) : "時間未定",
            text: `${g.opponent || "未定"} 対 ${g.opponent2 || "未定"}（STORMは審判担当）`,
            others: true,
          }
        : { time: g.start ? formatTime(g.start) : "時間未定", text: `vs ${g.opponent || "未定"}`, others: false },
    );

  const notes: string[] = [];
  if (u.note) notes.push(u.note);
  if (u.tournamentName && u.tournamentState === "postponed") {
    notes.push(`${reserveText(u) ? `${reserveText(u)}。` : ""}${u.tournamentName}が延期になったため、この日に大会を行います。`);
  } else if (u.tournamentName && u.tournamentState !== "not_held") {
    notes.push(`${reserveText(u) ? `${reserveText(u)}。` : ""}${u.tournamentName}が実施される場合は休養日、実施されない場合は練習です。決まり次第ご連絡します。`);
  }

  return {
    key: u.division,
    division: u.division,
    showDivision,
    title: u.activityType || "活動",
    rest: false,
    lines,
    games,
    notes,
  };
}

/** 期間・送り先に合う活動日を、印刷用の行にする */
export function buildRows(days: DaySummary[], divisions: Division[], year: number, month: number, period: Period): PrintRow[] {
  const { from, to } = periodRange(year, month, period);
  const wantsBothClubs = divisions.includes("top") && divisions.includes("academy");
  const rows: PrintRow[] = [];

  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    const units = d.units.filter((u) => divisions.includes(u.division));
    if (units.length === 0) continue;
    const showDivision = (u: UnitSummary) => u.division !== "storm" && (units.length > 1 || wantsBothClubs);
    const groups = units.map((u) => groupOf(u, showDivision(u)));
    const wd = weekdayIndex(d.date);
    rows.push({
      date: d.date,
      day: Number(d.date.slice(8, 10)),
      weekday: weekdayLabel(d.date),
      weekend: wd === 0 || wd === 6,
      sat: wd === 6,
      sun: wd === 0,
      groups,
      quiet: groups.every((g) => g.rest),
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** 画面に出す「送り先」の名前（区分の組み合わせから） */
export function audienceName(divisions: Division[]): string {
  const hit = AUDIENCES.find((a) => a.divisions.length === divisions.length && a.divisions.every((x) => divisions.includes(x)));
  if (hit) return hit.label;
  const names = divisions.filter((d) => d !== "storm").map((d) => DIVISION_LABEL[d]);
  return names.length ? `STORM ${names.join("・")}` : "STORMクラブ";
}
