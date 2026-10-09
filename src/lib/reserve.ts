// ============================================================
// 大会の「予備日」：大会の日に入れた予備日を、その日付のほうに自動で出す
//   延期のとき → 大会（予備日の会場）／実施のとき → その日の予定（なければ休養日）
// ============================================================

import { formatTime, weekdayLabel } from "./divisions";
import { type DaySummary, isRest, type UnitSummary } from "./status";
import type { Division } from "./divisions";

export interface ReserveInfo {
  /** 大会の本来の日 */
  fromDate: string;
  division: Division;
  /** 例：JJBF 1日目 */
  name: string;
  /** 延期のときの会場（空なら本来の会場と同じ） */
  venue: string;
  /** 予備日に審判を出す人 */
  umpires: string[];
  /** 予備日に必要な審判の人数（審判が不要なら0） */
  needed: number;
  /** 1 = 予備日 / 2 = 予備日の予備日 */
  level: 1 | 2;
  /** 審判の集合時間（例：7:45。なければ空） */
  umpireGather: string;
  /** 予備日の予備日のとき：ひとつ目の予備日 */
  firstDate?: string;
}

export function md(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

export function mdw(date: string): string {
  return `${md(date)}（${weekdayLabel(date)}）`;
}

/** 予備日の日付 → その日にあたる大会の一覧 */
export function reservesByDate(days: DaySummary[]): Map<string, ReserveInfo[]> {
  const map = new Map<string, ReserveInfo[]>();
  for (const d of days) {
    for (const u of d.units) {
      if (!u.reserveDate) continue;
      const info: ReserveInfo = {
        fromDate: d.date,
        division: u.division,
        name: u.reserveName || u.activityType || "大会",
        venue: u.reserveVenue || u.venue || u.groundName || "",
        umpires: u.reserveUmpires ?? [],
        needed: u.umpireRequired ? u.umpireNeeded : 0,
        level: 1,
        umpireGather: u.umpireRequired && u.umpireGatherTime ? formatTime(u.umpireGatherTime) : "",
      };
      map.set(u.reserveDate, [...(map.get(u.reserveDate) ?? []), info]);
      if (u.reserve2Date) {
        const info2: ReserveInfo = {
          ...info,
          venue: u.reserve2Venue || info.venue,
          umpires: u.reserve2Umpires ?? [],
          level: 2,
          firstDate: u.reserveDate,
        };
        map.set(u.reserve2Date, [...(map.get(u.reserve2Date) ?? []), info2]);
      }
    }
  }
  return map;
}

/** 「大会が実施されたとき」のその日の予定（なければ休養日） */
export function heldPlanText(units: UnitSummary[]): string {
  const active = units.filter((u) => !isRest(u) && (u.activityType || u.venue || u.playerGatherTime));
  if (!active.length) return "休養日";
  return active
    .map((u) =>
      [u.activityType, u.venue || (u.groundState === "decided" ? u.groundName : ""), u.playerGatherTime ? `集合 ${formatTime(u.playerGatherTime)}` : ""]
        .filter(Boolean)
        .join("　"),
    )
    .join(" ／ ");
}

/** 「2/4名　石川・上村（あと2名）」のような審判の言い方 */
export function umpireStatusText(names: string[], needed: number): string {
  if (needed <= 0) return names.join("・");
  const short = Math.max(0, needed - names.length);
  const head = `${names.length}/${needed}名`;
  if (names.length === 0) return `${needed}名必要（あと${short}名）`;
  return `${head}　${names.join("・")}${short ? `（あと${short}名）` : ""}`;
}

export function reserveHeading(r: ReserveInfo): string {
  return `${md(r.fromDate)} ${r.name} の${r.level === 2 ? "予備日の予備日" : "予備日"}`;
}

/** 予備日にあたる日の「予備日だと分かる」情報を、その日の各区分に入れる（休み・練習の表示用） */
export function applyReserves(days: DaySummary[]): DaySummary[] {
  const map = reservesByDate(days);
  return days.map((d) => {
    const r = map.get(d.date);
    if (!r?.length) return d;
    return { ...d, units: d.units.map((u) => (u.tournamentName ? { ...u, tournamentDate: r[0].fromDate } : u)) };
  });
}
