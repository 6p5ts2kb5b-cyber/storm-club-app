// ============================================================
// スタッフ用「月間予定表」の中身を作る（計算だけ）
// 活動日のデータ → 印刷用の行（日付ごと・区分ごと）に並べ直します。
// ============================================================

import { DIVISION_LABEL, type Division, formatTime, weekdayIndex, weekdayLabel } from "./divisions";
import { holidayName, isHoliday } from "./holidays";
import { heldPlanText, mdw, reserveHeading, reservesByDate, umpireStatusText } from "./reserve";
import { type DaySummary, isRest, reserveText, restWhy, type UnitSummary } from "./status";

/** 送り先のよく使う組み合わせ */
export const AUDIENCES: { key: string; label: string; divisions: Division[] }[] = [
  { key: "all", label: "STORM全体", divisions: ["storm", "top", "academy"] },
  { key: "top", label: "トップ", divisions: ["storm", "top"] },
  { key: "academy", label: "アカデミー", divisions: ["storm", "academy"] },
];

export type Period = "month" | "first" | "second" | "week" | "nextWeek" | "weekend" | "nextWeekend";

export const PERIOD_LABEL: Record<Period, string> = {
  month: "1カ月",
  first: "前半（1〜15日）",
  second: "後半（16日〜末日）",
  week: "今週（月〜日）",
  nextWeek: "来週（月〜日）",
  weekend: "今週末（土日＋つながる祝日）",
  nextWeekend: "来週末（土日＋つながる祝日）",
};

export const PERIOD_SHORT: Record<Period, string> = {
  month: "1カ月",
  first: "前半",
  second: "後半",
  week: "今週",
  nextWeek: "来週",
  weekend: "今週末",
  nextWeekend: "来週末",
};

/** その月の最終日（2月は28/29日を自動で） */
export function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, "0");

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

/** 載せる日のリスト（"2026-11-01" 形式）。月・前半・後半・週・週末を同じ仕組みで扱う */
export function periodDates(today: string, year: number, month: number, period: Period): string[] {
  const out: string[] = [];
  if (period === "month" || period === "first" || period === "second") {
    const last = lastDayOf(year, month);
    const fromDay = period === "second" ? 16 : 1;
    const toDay = period === "first" ? 15 : last;
    for (let d = fromDay; d <= toDay; d++) out.push(`${year}-${pad(month)}-${pad(d)}`);
    return out;
  }
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=日
  const monday = addDays(today, -((wd + 6) % 7) + (period === "nextWeek" || period === "nextWeekend" ? 7 : 0));
  if (period === "week" || period === "nextWeek") {
    for (let i = 0; i < 7; i++) out.push(addDays(monday, i));
    return out;
  }
  const sat = addDays(monday, 5);
  const sun = addDays(monday, 6);
  out.push(sat, sun);
  // 前の金曜・後ろの月曜…が祝日なら足す（3連休）
  for (let d = addDays(sat, -1); isHoliday(d); d = addDays(d, -1)) out.unshift(d);
  for (let d = addDays(sun, 1); isHoliday(d); d = addDays(d, 1)) out.push(d);
  return out;
}

const mdwLabel = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日（${weekdayLabel(date)}）`;

/** 紙の見出し：「STORM全体　2026年11月前半（1日〜15日）の活動予定」「STORM全体　今週末　10月10日（土）〜12日（月）の活動予定」 */
export function sheetTitle(audience: string, dates: string[], year: number, month: number, period: Period): string {
  if (dates.length === 0) return `${audience}　${year}年${month}月の活動予定`;
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (period === "week" || period === "nextWeek" || period === "weekend" || period === "nextWeekend") {
    const lastText = first.slice(0, 7) === last.slice(0, 7) ? `${Number(last.slice(8))}日（${weekdayLabel(last)}）` : mdwLabel(last);
    return `${audience}　${PERIOD_SHORT[period]}　${mdwLabel(first)}〜${lastText}の活動予定`;
  }
  const f = Number(first.slice(8));
  const l = Number(last.slice(8));
  const full = f === 1 && l === lastDayOf(year, month);
  const part = period === "first" ? `前半（${f}日〜${l}日）` : period === "second" ? `後半（${f}日〜${l}日）` : full ? "" : `（${f}日〜${l}日）`;
  return `${audience}　${year}年${month}月${part}の活動予定`;
}

export interface PrintLine {
  k: string;
  v: string;
  strong?: boolean;
  /** 太字（指導者・審判など） */
  bold?: boolean;
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
  /** 予備日（大会の日にだけ）例：10/17（土）　会場 */
  reserve?: string;
  /** 予備日の予備日 */
  reserve2?: string;
  /** 試合のあとに出す項目（指導者・審判・予備日の審判） */
  after: PrintLine[];
}

export interface PrintRow {
  date: string;
  day: number;
  weekday: string;
  weekend: boolean;
  sat: boolean;
  sun: boolean;
  /** 祝日の名前（祝日でなければ空） */
  holiday: string;
  /** 予定が入っていない土日・祝日（「活動なし」と載せる） */
  blank: boolean;
  groups: PrintGroup[];
  /** 休みだけの日（細い1行にする） */
  quiet: boolean;
  /** この日が予備日になっている大会の案内（青い帯） */
  reserves: { heading: string; name: string; postponed: string; held: string; umpires: string }[];
}

/** 練習試合は「練習試合」ではなく「対 ○○・△△」（相手が決まっていれば） */
function matchTitle(u: UnitSummary): string {
  const type = u.activityType || "活動";
  if (type !== "練習試合") return type;
  const names = [...new Set(u.games.filter((g) => g.stormPlays !== false).flatMap((g) => [g.opponent]).filter(Boolean) as string[])];
  return names.length ? `対 ${names.join("・")}` : type;
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
      after: [],
      notes: [reserveText(u) ? `${reserveText(u)}（大会が実施されたため）` : restWhy(u)],
    };
  }

  const lines: PrintLine[] = [];
  const gather = [u.playerGatherTime ? formatTime(u.playerGatherTime) : "", u.gatherPlace ?? ""].filter(Boolean).join("　");
  if (gather) lines.push({ k: "選手集合", v: gather, strong: true });
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
  } else if (u.tournamentName && u.tournamentState === "not_held" && u.tournamentDate) {
    notes.push(`${reserveText(u)}。大会が実施されたため、この日は練習です。`);
  } else if (u.tournamentName && u.tournamentState !== "not_held") {
    notes.push(`${reserveText(u) ? `${reserveText(u)}。` : ""}${u.tournamentName}が実施される場合は休養日または練習です。決まり次第ご連絡します。`);
  }

  // 指導者・審判（決まっている名前と、足りない人数）
  const after: PrintLine[] = [];
  if (u.coaches.length) after.push({ k: "指導者", v: u.coaches.join("・"), bold: true });
  if (u.umpireRequired) {
    const names = [...new Set((u.umpireSlots ?? []).filter((s) => s.staffId && s.staffName).map((s) => s.staffName as string))];
    if (u.umpireGatherTime) after.push({ k: "審判集合", v: formatTime(u.umpireGatherTime), strong: true });
    after.push({ k: "審判", v: umpireStatusText(names, u.umpireNeeded), bold: true });
    if (u.reserveDate) {
      after.push({ k: "予備日審判", v: umpireStatusText(u.reserveUmpires ?? [], u.umpireNeeded), bold: true });
    }
    if (u.reserve2Date) {
      after.push({ k: "予備日2審判", v: umpireStatusText(u.reserve2Umpires ?? [], u.umpireNeeded), bold: true });
    }
  }

  return {
    key: u.division,
    division: u.division,
    showDivision,
    title: matchTitle(u),
    rest: false,
    lines,
    games,
    notes,
    after,
    reserve2: u.reserve2Date ? `${mdw(u.reserve2Date)}${u.reserve2Venue ? `　${u.reserve2Venue}` : ""}` : undefined,
    reserve: u.reserveDate ? `${mdw(u.reserveDate)}${u.reserveVenue ? `　${u.reserveVenue}` : ""}` : undefined,
  };
}

/** 載せる日のリストと送り先に合う活動日を、印刷用の行にする */
export function buildRows(days: DaySummary[], divisions: Division[], dates: string[]): PrintRow[] {
  const wantsBothClubs = divisions.includes("top") && divisions.includes("academy");
  const reserveMap = reservesByDate(days);
  const rows: PrintRow[] = [];

  for (const date of dates) {
    const d = days.find((x) => x.date === date);
    const units = (d?.units ?? []).filter((u) => divisions.includes(u.division));
    const reserves = (reserveMap.get(date) ?? []).filter((r) => divisions.includes(r.division));
    const wd = weekdayIndex(date);
    const holiday = holidayName(date);
    const off = wd === 0 || wd === 6 || holiday !== "";
    const base = {
      date,
      day: Number(date.slice(8, 10)),
      weekday: weekdayLabel(date),
      weekend: off,
      sat: wd === 6 && !holiday,
      sun: wd === 0 || holiday !== "",
      holiday,
    };
    if (units.length === 0 && reserves.length === 0) {
      // 予定の無い日：土日・祝日は「活動なし」と載せる。平日は載せない
      if (off) rows.push({ ...base, blank: true, groups: [], quiet: false, reserves: [] });
      continue;
    }
    const showDivision = (u: UnitSummary) => u.division !== "storm" && (units.length > 1 || wantsBothClubs);
    let groups = units.map((u) => groupOf(u, showDivision(u)));
    // 予備日の日の「休養日」は青い帯に出るので、重ねて出さない
    if (reserves.length && groups.every((g) => g.rest)) groups = [];
    const held = heldPlanText(units);
    rows.push({
      ...base,
      blank: false,
      groups,
      quiet: groups.length > 0 && groups.every((g) => g.rest),
      reserves: reserves.map((r) => ({
        heading: reserveHeading(r),
        name: r.name,
        postponed: `${r.name}${r.venue ? `（${r.venue}）` : ""}`,
        held,
        umpires:
          r.needed > 0 || r.umpires.length ? `${r.umpireGather ? `審判集合 ${r.umpireGather}　` : ""}${umpireStatusText(r.umpires, r.needed)}` : "",
      })),
    });
  }
  return rows;
}

/** 「LINEに貼る文章」：予定表と同じ中身（持ち物は書かない） */
export function buildPrintText(rows: PrintRow[], title: string, message: string): string {
  const out: string[] = [`【${title.replace("　", " ")}】`, ""];
  for (const r of rows) {
    const head = `${Number(r.date.slice(5, 7))}/${r.day}（${r.weekday}${r.holiday ? `・${r.holiday}` : ""}）`;
    if (r.blank) {
      out.push(`${head} 活動なし`, "");
      continue;
    }
    const allRest = r.groups.length > 0 && r.groups.every((g) => g.rest);
    if (allRest && r.reserves.length === 0 && r.groups.length === 1) {
      out.push(`${head} ${r.groups[0].showDivision ? `［${DIVISION_LABEL[r.groups[0].division]}］` : ""}休養日`, "");
      continue;
    }
    out.push(head);
    for (const x of r.reserves) {
      out.push(`　☂ ${x.heading}`, `　${x.name}が延期された場合　${x.postponed}`);
      if (x.umpires) out.push(`　　${x.umpires}`);
      out.push(`　${x.name}が実施された場合　${x.held}`);
    }
    for (const g of r.groups) {
      const tag = g.showDivision ? `［${DIVISION_LABEL[g.division]}］` : "";
      out.push(`　${tag}${g.title}`);
      for (const l of g.lines) out.push(`　　${l.k}　${l.v}`);
      g.games.forEach((x, i) => out.push(`　　${"①②③④⑤⑥"[i] ?? i + 1}　${x.time}　${x.text}`));
      for (const l of g.after) out.push(`　　${l.k}　${l.v}`);
      if (g.reserve) out.push(`　　予備日　${g.reserve}`);
      if (g.reserve2) out.push(`　　予備日の予備日　${g.reserve2}`);
      if (!g.rest) for (const n of g.notes) out.push(`　　※${n}`);
    }
    out.push("");
  }
  if (message.trim()) out.push(message.trim());
  return out.join("\n").trim();
}

/** 画面に出す「送り先」の名前（区分の組み合わせから） */
export function audienceName(divisions: Division[]): string {
  const hit = AUDIENCES.find((a) => a.divisions.length === divisions.length && a.divisions.every((x) => divisions.includes(x)));
  if (hit) return hit.label;
  const names = divisions.filter((d) => d !== "storm").map((d) => DIVISION_LABEL[d]);
  return names.length ? `STORM ${names.join("・")}` : "STORMクラブ";
}
