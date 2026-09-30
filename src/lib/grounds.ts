// グラウンド候補の形・表示名・状態の判定

export type SchoolUse = "none" | "planned" | "unknown";
export type StormUse = "ok" | "ng" | "unknown";
export type GroundStatus = "candidate" | "checking" | "available" | "unavailable" | "decided";

export interface Ground {
  id: string;
  school_name: string;
  ground_name: string | null;
  school_use: SchoolUse;
  storm_use: StormUse;
  status: GroundStatus;
  note: string | null;
}

export type GroundInput = Omit<Ground, "id">;

export const SCHOOL_USE_LABEL: Record<SchoolUse, string> = { none: "なし", planned: "あり", unknown: "不明" };
export const STORM_USE_LABEL: Record<StormUse, string> = { ok: "可能", ng: "不可", unknown: "未確認" };
export const STATUS_LABEL: Record<GroundStatus, string> = {
  candidate: "候補",
  checking: "確認中",
  available: "使用可能",
  unavailable: "使用不可",
  decided: "使用決定",
};

/** 並び順：使用決定 → 使用可能 → 確認中 → 候補 → 使用不可 */
const ORDER: GroundStatus[] = ["decided", "available", "checking", "candidate", "unavailable"];
export function sortGrounds(list: Ground[]): Ground[] {
  return [...list].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
}

export const EMPTY_GROUND: GroundInput = {
  school_name: "",
  ground_name: "",
  school_use: "unknown",
  storm_use: "unknown",
  status: "candidate",
  note: "",
};

export function groundLabel(g: Pick<Ground, "school_name" | "ground_name">): string {
  return g.ground_name ? `${g.school_name}（${g.ground_name}）` : g.school_name;
}

/**
 * 候補一覧から、活動カードに出す状態を決めます。
 *   使用決定あり          → decided（🟢 確定）
 *   確認中あり            → checking（🟡 確認中）
 *   使えそうな候補がある  → undecided（🟡 未決定）
 *   候補なし／全部使用不可 → none（🔴 未確保）
 */
export function deriveGround(list: Ground[]): {
  groundState: "decided" | "checking" | "undecided" | "none";
  groundName?: string;
  candidateCount: number;
} {
  const usable = list.filter((g) => g.status !== "unavailable");
  const decided = list.find((g) => g.status === "decided");
  if (decided) return { groundState: "decided", groundName: groundLabel(decided), candidateCount: usable.length };
  if (list.some((g) => g.status === "checking")) return { groundState: "checking", candidateCount: usable.length };
  if (usable.length > 0) return { groundState: "undecided", candidateCount: usable.length };
  return { groundState: "none", candidateCount: 0 };
}
