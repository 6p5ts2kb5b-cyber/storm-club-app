// ============================================================
// 活動日のデータを読み込む場所（サーバー側）
// Supabaseにつながっていれば本物のデータ、つながる前はサンプルを返します。
// ============================================================

import { divisionsForMode, type DayMode, type Division } from "./divisions";
import { SAMPLE_DAYS } from "./sample";
import type { DaySummary, UnitSummary } from "./status";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

/** データベースの activity_units の1行 */
export interface UnitRow {
  id: string;
  division: Division;
  activity_type: string | null;
  venue: string | null;
  player_gather_time: string | null;
  umpire_required: boolean;
  umpire_needed_count: number;
  umpire_offset_min: number;
  umpire_gather_time: string | null;
  note: string | null;
}

/** データベースの activity_days の1行（活動単位つき） */
export interface DayRow {
  id: string;
  date: string;
  mode: DayMode;
  note: string | null;
  activity_units: UnitRow[];
}

const DAY_SELECT =
  "id,date,mode,note,activity_units(id,division,activity_type,venue,player_gather_time,umpire_required,umpire_needed_count,umpire_offset_min,umpire_gather_time,note)";

const DIVISION_ORDER: Division[] = ["top", "academy", "storm"];

/** "07:30:00" → "07:30" */
function hhmm(t: string | null): string | undefined {
  return t ? t.slice(0, 5) : undefined;
}

function unitToSummary(u: UnitRow): UnitSummary {
  return {
    id: u.id,
    division: u.division,
    activityType: u.activity_type ?? undefined,
    note: u.note ?? undefined,
    venue: u.venue ?? undefined,
    playerGatherTime: hhmm(u.player_gather_time),
    // ↓ グラウンド・指導者・試合・審判の割り当ては STEP6〜12 でつなぎます
    groundState: "none",
    candidateCount: 0,
    coaches: [],
    umpireRequired: u.umpire_required,
    umpireNeeded: u.umpire_needed_count,
    umpireAssigned: 0,
    umpireGatherTime: hhmm(u.umpire_gather_time),
    games: [],
    openPositions: [],
  };
}

/** データベースの行を、画面で使う形に直します（いまの区分モードの単位だけ表示） */
export function dayToSummary(d: DayRow): DaySummary {
  const wanted = divisionsForMode(d.mode);
  const units = (d.activity_units ?? [])
    .filter((u) => wanted.includes(u.division))
    .sort((a, b) => DIVISION_ORDER.indexOf(a.division) - DIVISION_ORDER.indexOf(b.division))
    .map(unitToSummary);
  return {
    id: d.id,
    date: d.date,
    mode: d.mode,
    note: d.note ?? undefined,
    activityType: units.find((u) => u.activityType)?.activityType ?? "",
    units,
  };
}

export type LoadResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** 活動日の一覧（from を指定するとその日以降だけ） */
export async function loadDays(from?: string): Promise<LoadResult<DaySummary[]>> {
  if (!isSupabaseConfigured) {
    const days = SAMPLE_DAYS.filter((d) => !from || d.date >= from);
    return { ok: true, data: days };
  }
  const supabase = await createClient();
  let query = supabase.from("activity_days").select(DAY_SELECT).order("date");
  if (from) query = query.gte("date", from);
  const { data, error } = await query;
  if (error) return { ok: false, message: "活動日を読み込めませんでした。インターネットの接続を確認して、再読み込みしてください。" };
  return { ok: true, data: ((data ?? []) as DayRow[]).map(dayToSummary) };
}

/** 1日分（なければ null） */
export async function loadDay(date: string): Promise<LoadResult<DaySummary | null>> {
  if (!isSupabaseConfigured) {
    return { ok: true, data: SAMPLE_DAYS.find((d) => d.date === date) ?? null };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("activity_days").select(DAY_SELECT).eq("date", date).maybeSingle();
  if (error) return { ok: false, message: "活動日を読み込めませんでした。インターネットの接続を確認して、再読み込みしてください。" };
  return { ok: true, data: data ? dayToSummary(data as DayRow) : null };
}

/** ログイン中の人が管理者か（お試しモードでは管理者として扱う） */
export async function currentIsAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
