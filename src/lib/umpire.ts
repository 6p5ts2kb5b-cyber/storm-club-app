// ============================================================
// 審判のルール（人数制・ポジション・集合時間の逆算・不足の判定）
// 画面にもサーバーにも使う「計算だけ」の場所です。
// ============================================================

import type { Game } from "./status";

export type Position = "plate" | "first" | "second" | "third" | "base";
export type UmpireSystem = 1 | 2 | 3 | 4;

export const POSITION_LABEL: Record<Position, string> = {
  plate: "球審",
  first: "一塁審",
  second: "二塁審",
  third: "三塁審",
  base: "塁審",
};

/** 人数制ごとに必要なポジション（基本は4人制） */
export const SYSTEM_POSITIONS: Record<UmpireSystem, Position[]> = {
  1: ["plate"],
  2: ["plate", "base"],
  3: ["plate", "first", "third"],
  4: ["plate", "first", "second", "third"],
};

export const SYSTEM_LABEL: Record<UmpireSystem, string> = { 1: "1人制", 2: "2人制", 3: "3人制", 4: "4人制" };

export const DEFAULT_SYSTEM: UmpireSystem = 4;
export const DEFAULT_OFFSET = 60;
export const OFFSET_CHOICES = [30, 45, 60, 90];

/** 審判の枠に入っている人（スタッフ または 相手チーム） */
export interface Slot {
  id?: string;
  gameId: string;
  position: Position;
  staffId?: string;
  staffName?: string;
  opponent: boolean;
}

/** 審判一人ずつの集合時間の設定 */
export interface UmpirePerson {
  staffId: string;
  /** この人だけ「何分前集合か」を変える場合 */
  offsetMin?: number;
  /** この人の集合時間を手動で決めた場合 "08:15" */
  gatherTime?: string;
  note?: string;
}

/** "09:00" から minutes 分前 → "08:00"（0:00より前にはしない） */
export function timeMinus(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, h * 60 + m - minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** 「他チームが担当」の枠に出すチーム名（未入力なら「他チーム」） */
export function umpireTeamLabel(g: Game | undefined): string {
  return g?.umpireTeam?.trim() || "他チーム";
}

/** 対戦カード。STORMが出る試合は「STORM vs ◯◯」、出ない試合は「A vs B」 */
export function matchupText(g: Game): string {
  if (g.stormPlays === false) return `${g.opponent || "未定"} vs ${g.opponent2 || "未定"}`;
  return `STORM vs ${g.opponent || "相手未定"}`;
}

export function systemOf(g: Game): UmpireSystem {
  return (g.system ?? DEFAULT_SYSTEM) as UmpireSystem;
}

/** その試合で、いま有効な枠だけを返す（人数制から外れたポジションは数えない） */
export function activeSlots(games: Game[], slots: Slot[]): Slot[] {
  return slots.filter((s) => {
    const g = games.find((x) => x.id === s.gameId);
    return g ? SYSTEM_POSITIONS[systemOf(g)].includes(s.position) : false;
  });
}

/** 枠が埋まっているか（スタッフ または 相手チーム） */
export function isFilled(s: Slot | undefined): boolean {
  return Boolean(s && (s.opponent || s.staffId));
}

/** 空いている枠の一覧（例：「第1試合 二塁審」） */
export function openPositionList(games: Game[], slots: Slot[]): string[] {
  const list: string[] = [];
  for (const g of [...games].sort((a, b) => a.no - b.no)) {
    for (const pos of SYSTEM_POSITIONS[systemOf(g)]) {
      const s = slots.find((x) => x.gameId === g.id && x.position === pos);
      if (!isFilled(s)) list.push(`第${g.no}試合 ${POSITION_LABEL[pos]}`);
    }
  }
  return list;
}

/** 審判をするSTORMのスタッフ（重複なし） */
export function assignedStaffIds(games: Game[], slots: Slot[]): string[] {
  return [...new Set(activeSlots(games, slots).filter((s) => s.staffId).map((s) => s.staffId as string))];
}

/** 活動全体の審判集合時間（自動計算）：最初に時間が決まっている試合 − 何分前 */
export function autoUnitGather(games: Game[], offset: number): string | undefined {
  const first = [...games].sort((a, b) => a.no - b.no).find((g) => g.start);
  return first?.start ? timeMinus(first.start, offset) : undefined;
}

/** 「第2〜3試合」「第1・3試合」「第2試合」 */
export function gameRangeText(nos: number[]): string {
  const sorted = [...new Set(nos)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return `第${sorted[0]}試合`;
  const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  return contiguous ? `第${sorted[0]}〜${sorted.at(-1)}試合` : `第${sorted.join("・")}試合`;
}

/** 審判担当一覧の1行 */
export interface RosterRow {
  key: string;
  staffId?: string;
  name: string;
  opponent: boolean;
  gameNos: number[];
  rangeText: string;
  gameCount: number;
  positions: string;
  /** 集合時間（相手チームはなし） */
  gather?: string;
  /** 集合時間の決め方 */
  gatherSource?: "manual" | "auto";
  offsetMin?: number;
  note?: string;
}

/** 審判担当一覧（スタッフごとにまとめる。相手チームは最後に1行） */
export function buildRoster(
  games: Game[],
  slots: Slot[],
  people: UmpirePerson[],
  unitOffset: number,
  nameOf: (staffId: string) => string,
): RosterRow[] {
  const gameById = new Map(games.map((g) => [g.id, g]));
  const active = activeSlots(games, slots).filter(isFilled);
  const rows: RosterRow[] = [];

  for (const staffId of assignedStaffIds(games, slots)) {
    const mine = active.filter((s) => s.staffId === staffId);
    const nos = mine.map((s) => gameById.get(s.gameId)?.no ?? 0).filter(Boolean);
    const firstNo = Math.min(...nos);
    const firstGame = games.find((g) => g.no === firstNo);
    const person = people.find((p) => p.staffId === staffId);
    const offset = person?.offsetMin ?? unitOffset;
    const auto = firstGame?.start ? timeMinus(firstGame.start, offset) : undefined;
    const positions = [...new Set(mine.map((s) => POSITION_LABEL[s.position]))].join("・");
    rows.push({
      key: staffId,
      staffId,
      name: mine.find((s) => s.staffName)?.staffName ?? nameOf(staffId),
      opponent: false,
      gameNos: nos,
      rangeText: gameRangeText(nos),
      gameCount: new Set(nos).size,
      positions,
      gather: person?.gatherTime ?? auto,
      gatherSource: person?.gatherTime ? "manual" : "auto",
      offsetMin: offset,
      note: person?.note,
    });
  }
  rows.sort((a, b) => (a.gather ?? "99").localeCompare(b.gather ?? "99") || a.gameNos[0] - b.gameNos[0]);

  const opp = active.filter((s) => s.opponent);
  if (opp.length) {
    const nos = opp.map((s) => gameById.get(s.gameId)?.no ?? 0).filter(Boolean);
    const teams = [...new Set(opp.map((s) => umpireTeamLabel(gameById.get(s.gameId))))];
    rows.push({
      key: "opponent",
      name: teams.join("・"),
      opponent: true,
      gameNos: nos,
      rangeText: gameRangeText(nos),
      gameCount: new Set(nos).size,
      positions: `${opp.length}枠`,
    });
  }
  return rows;
}

/** 活動単位の審判まわりの集計（ホーム・カード・要確認で使用） */
export function deriveUmpire(u: {
  umpireRequired: boolean;
  games: Game[];
  umpireSlots?: Slot[];
  umpireOffset?: number;
  umpireGatherManual?: string;
}): { umpireAssigned: number; openPositions: string[]; umpireGatherTime?: string; umpireGatherAuto?: string } {
  const slots = u.umpireSlots ?? [];
  const auto = autoUnitGather(u.games, u.umpireOffset ?? DEFAULT_OFFSET);
  if (!u.umpireRequired) {
    return { umpireAssigned: 0, openPositions: [], umpireGatherTime: undefined, umpireGatherAuto: auto };
  }
  return {
    umpireAssigned: assignedStaffIds(u.games, slots).length,
    openPositions: openPositionList(u.games, slots),
    umpireGatherTime: u.umpireGatherManual ?? auto,
    umpireGatherAuto: auto,
  };
}
