// ============================================================
// 大会の「予備日」：大会の日に入れた予備日を、その日付のほうに自動で出す
//   延期のとき → 大会（予備日の会場）／実施のとき → その日の予定（なければ休養日）
// ============================================================

import { formatTime, weekdayLabel } from "./divisions";
import type { DaySummary, UnitSummary } from "./status";
import type { Division } from "./divisions";

export interface ReserveInfo {
  /** 大会の本来の日 */
  fromDate: string;
  division: Division;
  /** 例：JJBF 1日目 */
  name: string;
  /** 延期のときの会場（空なら本来の会場と同じ） */
  venue: string;
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
      };
      map.set(u.reserveDate, [...(map.get(u.reserveDate) ?? []), info]);
    }
  }
  return map;
}

/** 「大会が実施されたとき」のその日の予定（なければ休養日） */
export function heldPlanText(units: UnitSummary[]): string {
  const active = units.filter((u) => !(u.tournamentName && u.tournamentState === "held") && (u.activityType || u.venue || u.playerGatherTime));
  if (!active.length) return "休養日";
  return active
    .map((u) =>
      [u.activityType, u.venue || (u.groundState === "decided" ? u.groundName : ""), u.playerGatherTime ? `集合 ${formatTime(u.playerGatherTime)}` : ""]
        .filter(Boolean)
        .join("　"),
    )
    .join(" ／ ");
}

export function reserveHeading(r: ReserveInfo): string {
  return `${md(r.fromDate)} ${r.name} の予備日`;
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
