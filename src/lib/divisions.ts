// ============================================================
// 活動区分・日付まわりの共通ルール
// ここは「日付から トップ・アカデミー か STORM かを決める」など、
// アプリ全体で使う決まりごとをまとめた場所です。
// ============================================================

/** 活動区分 */
export type Division = "storm" | "top" | "academy";

/** 1日の区分モード：split = トップ・アカデミーに分かれる / single = STORMクラブ1つ */
export type DayMode = "split" | "single";

export const DIVISION_LABEL: Record<Division, string> = {
  storm: "STORMクラブ",
  top: "トップ",
  academy: "アカデミー",
};

/** 12月〜4月は分かれて活動する月 */
const SPLIT_MONTHS = [12, 1, 2, 3, 4];

/**
 * 日付（"2026-12-05" の形）から区分モードを自動で決めます。
 * 12月〜4月 → split（トップ・アカデミー）
 * 5月〜11月 → single（STORMクラブ）
 * ※管理者は活動日ごとに手動で変更できます（STEP5で実装）。
 */
export function autoModeForDate(isoDate: string): DayMode {
  const month = Number(isoDate.slice(5, 7));
  return SPLIT_MONTHS.includes(month) ? "split" : "single";
}

/** 区分モードから、その日に管理する区分の一覧を返します */
export function divisionsForMode(mode: DayMode): Division[] {
  return mode === "split" ? ["top", "academy"] : ["storm"];
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-12-05" → 曜日の番号（0=日曜） */
export function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2026-12-05" → "12月5日（土）" */
export function formatDateLong(isoDate: string): string {
  const m = Number(isoDate.slice(5, 7));
  const d = Number(isoDate.slice(8, 10));
  return `${m}月${d}日（${WEEKDAYS[weekdayIndex(isoDate)]}）`;
}

/** "2026-12-05" → "12/5" */
export function formatDateShort(isoDate: string): string {
  return `${Number(isoDate.slice(5, 7))}/${Number(isoDate.slice(8, 10))}`;
}

/** 日本時間の「今日」を "2026-09-30" の形で返します */
export function todayInTokyo(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** 今日から何日後か（0 = 今日） */
export function daysFromToday(isoDate: string, today: string = todayInTokyo()): number {
  const a = Date.parse(`${isoDate}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

/**
 * 試合開始時間から集合時間を逆算します。
 * 例：subtractMinutes("09:00", 60) → "08:00"
 *     subtractMinutes("13:00", 45) → "12:15"
 */
export function subtractMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  let total = h * 60 + m - minutes;
  if (total < 0) total += 24 * 60;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

/** "07:30" → "7:30"（先頭の0を取って見やすく） */
export function formatTime(time?: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}
