// ============================================================
// スタッフ用「月間予定表」の中身を作る（計算だけ）
// 活動日のデータ → 印刷用の行（日付ごと・区分ごと）に並べ直します。
// ============================================================

import { DIVISION_LABEL, type Division, formatTime, weekdayIndex, weekdayLabel } from "./divisions";
import { heldPlanText, mdw, reserveHeading, reservesByDate, umpireStatusText } from "./reserve";
import { type DaySummary, isRest, reserveText, restWhy, type UnitSummary } from "./status";

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
  groups: PrintGroup[];
  /** 休みだけの日（細い1行にする） */
  quiet: boolean;
  /** この日が予備日になっている大会の案内（青い帯） */
  reserves: { heading: string; postponed: string; held: string; umpires: string }[];
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
    title: u.activityType || "活動",
    rest: false,
    lines,
    games,
    notes,
    after,
    reserve2: u.reserve2Date ? `${mdw(u.reserve2Date)}${u.reserve2Venue ? `　${u.reserve2Venue}` : ""}` : undefined,
    reserve: u.reserveDate ? `${mdw(u.reserveDate)}${u.reserveVenue ? `　${u.reserveVenue}` : ""}` : undefined,
  };
}

/** 期間・送り先に合う活動日を、印刷用の行にする */
export function buildRows(days: DaySummary[], divisions: Division[], year: number, month: number, period: Period): PrintRow[] {
  const { from, to } = periodRange(year, month, period);
  const wantsBothClubs = divisions.includes("top") && divisions.includes("academy");
  const reserveMap = reservesByDate(days);
  const rows: PrintRow[] = [];

  // 予備日にあたる日（その日に予定が登録されていなくても行を作る）
  const dates = new Set<string>(days.map((d) => d.date));
  reserveMap.forEach((list, date) => {
    if (list.some((r) => divisions.includes(r.division))) dates.add(date);
  });

  for (const date of dates) {
    if (date < from || date > to) continue;
    const d = days.find((x) => x.date === date);
    const units = (d?.units ?? []).filter((u) => divisions.includes(u.division));
    const reserves = (reserveMap.get(date) ?? []).filter((r) => divisions.includes(r.division));
    if (units.length === 0 && reserves.length === 0) continue;
    const showDivision = (u: UnitSummary) => u.division !== "storm" && (units.length > 1 || wantsBothClubs);
    let groups = units.map((u) => groupOf(u, showDivision(u)));
    // 予備日の日の「休養日」は青い帯に出るので、重ねて出さない
    if (reserves.length && groups.every((g) => g.rest)) groups = [];
    const held = heldPlanText(units);
    const wd = weekdayIndex(date);
    rows.push({
      date,
      day: Number(date.slice(8, 10)),
      weekday: weekdayLabel(date),
      weekend: wd === 0 || wd === 6,
      sat: wd === 6,
      sun: wd === 0,
      groups,
      quiet: groups.length > 0 && groups.every((g) => g.rest),
      reserves: reserves.map((r) => ({
        heading: reserveHeading(r),
        postponed: `${r.name}${r.venue ? `（${r.venue}）` : ""}`,
        held,
        umpires: r.needed > 0 || r.umpires.length ? umpireStatusText(r.umpires, r.needed) : "",
      })),
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
