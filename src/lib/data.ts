// ============================================================
// 活動日のデータを読み込む場所（サーバー側）
// Supabaseにつながっていれば本物のデータ、つながる前はサンプルを返します。
// ============================================================

import { divisionsForMode, type DayMode, type Division } from "./divisions";
import { deriveGround, type Ground, sortGrounds } from "./grounds";
import { SAMPLE_DAYS } from "./sample";
import { DEFAULT_OFFSET, deriveUmpire, type Position, type Slot } from "./umpire";
import { SAMPLE_STAFF } from "./staff";
import type { DaySummary, Game, UnitSummary } from "./status";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

/** データベースの activity_units の1行 */
export interface UnitRow {
  id: string;
  division: Division;
  activity_type: string | null;
  venue: string | null;
  player_gather_time: string | null;
  gather_place: string | null;
  umpire_required: boolean;
  umpire_needed_count: number;
  umpire_offset_min: number;
  umpire_gather_time: string | null;
  tournament_name: string | null;
  tournament_state: "pending" | "held" | "not_held" | "postponed" | "not_held_rest" | null;
  tournament_date: string | null;
  reserve_date: string | null;
  reserve_name: string | null;
  reserve_venue: string | null;
  reserve_umpires: string | null;
  note: string | null;
  grounds?: Ground[];
  games?: {
    id: string;
    game_no: number;
    start_time: string | null;
    opponent: string | null;
    storm_plays: boolean | null;
    opponent2: string | null;
    umpire_team: string | null;
    umpire_system: number | null;
    note: string | null;
    umpire_slots?: {
      id: string;
      position: Position;
      staff_id: string | null;
      is_opponent: boolean;
      staff: { name: string } | { name: string }[] | null;
    }[];
  }[];
  umpire_people?: { staff_id: string; offset_min: number | null; gather_time: string | null; note: string | null }[];
  // staff はデータベースから「1件」または「1件入りの一覧」で届くことがあるので両方に対応
  coach_assignments?: { staff_id: string; staff: { name: string } | { name: string }[] | null }[];
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
  "id,date,mode,note,activity_units(id,division,activity_type,venue,player_gather_time,gather_place,umpire_required,umpire_needed_count,umpire_offset_min,umpire_gather_time,tournament_name,tournament_state,tournament_date,reserve_date,reserve_name,reserve_venue,reserve_umpires,note,grounds(id,school_name,ground_name,school_use,storm_use,status,note),coach_assignments(staff_id,staff(name)),games(id,game_no,start_time,opponent,storm_plays,opponent2,umpire_team,umpire_system,note,umpire_slots(id,position,staff_id,is_opponent,staff(name))),umpire_people(staff_id,offset_min,gather_time,note))";

// 0009（3チーム対応）のSQLがまだのときも、画面が真っ白にならないように、古い項目だけで読み直す
const DAY_SELECT_OLD = DAY_SELECT.replace("storm_plays,opponent2,umpire_team,", "").replace("tournament_name,tournament_state,tournament_date,reserve_date,reserve_name,reserve_venue,reserve_umpires,", "");

const DIVISION_ORDER: Division[] = ["top", "academy", "storm"];

/** "07:30:00" → "07:30" */
function hhmm(t: string | null): string | undefined {
  return t ? t.slice(0, 5) : undefined;
}

function unitToSummary(u: UnitRow): UnitSummary {
  const grounds = sortGrounds(u.grounds ?? []);
  const staffName = (c: NonNullable<UnitRow["coach_assignments"]>[number]) =>
    (Array.isArray(c.staff) ? c.staff[0]?.name : c.staff?.name) ?? "（削除された人）";
  const coachRows = [...(u.coach_assignments ?? [])].sort((a, b) => staffName(a).localeCompare(staffName(b), "ja"));
  const slots: Slot[] = (u.games ?? []).flatMap((g) =>
    (g.umpire_slots ?? []).map((sl) => ({
      id: sl.id,
      gameId: g.id,
      position: sl.position,
      staffId: sl.staff_id ?? undefined,
      staffName: (Array.isArray(sl.staff) ? sl.staff[0]?.name : sl.staff?.name) ?? undefined,
      opponent: sl.is_opponent,
    })),
  );
  const summary: UnitSummary = {
    id: u.id,
    division: u.division,
    activityType: u.activity_type ?? undefined,
    note: u.note ?? undefined,
    venue: u.venue ?? undefined,
    playerGatherTime: hhmm(u.player_gather_time),
    gatherPlace: u.gather_place ?? undefined,
    tournamentName: u.tournament_name ?? undefined,
    tournamentState: u.tournament_name ? (u.tournament_state ?? "pending") : undefined,
    reserveDate: u.reserve_date ?? undefined,
    reserveName: u.reserve_name ?? undefined,
    reserveVenue: u.reserve_venue ?? undefined,
    reserveUmpires: u.reserve_umpires ? u.reserve_umpires.split("、").filter(Boolean) : undefined,
    grounds,
    ...deriveGround(grounds),
    coaches: coachRows.map(staffName),
    coachIds: coachRows.map((c) => c.staff_id),
    games: [...(u.games ?? [])]
      .sort((a, b) => a.game_no - b.game_no)
      .map(
        (g): Game => ({
          id: g.id,
          no: g.game_no,
          start: hhmm(g.start_time),
          opponent: g.opponent ?? undefined,
          stormPlays: g.storm_plays ?? true,
          opponent2: g.opponent2 ?? undefined,
          umpireTeam: g.umpire_team ?? undefined,
          system: (g.umpire_system ?? 4) as Game["system"],
          note: g.note ?? undefined,
        }),
      ),
    umpireRequired: u.umpire_required,
    umpireNeeded: u.umpire_needed_count,
    umpireOffset: u.umpire_offset_min ?? DEFAULT_OFFSET,
    umpireGatherManual: hhmm(u.umpire_gather_time),
    umpireSlots: slots,
    umpirePeople: (u.umpire_people ?? []).map((p) => ({
      staffId: p.staff_id,
      offsetMin: p.offset_min ?? undefined,
      gatherTime: hhmm(p.gather_time),
      note: p.note ?? undefined,
    })),
    // ↓ 以下は上の内容から自動で計算（決定人数・空き枠・審判集合時間）
    umpireAssigned: 0,
    openPositions: [],
  };
  return { ...summary, ...deriveUmpire(summary) };
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
  let { data, error } = await query;
  if (error) {
    let old = supabase.from("activity_days").select(DAY_SELECT_OLD).order("date");
    if (from) old = old.gte("date", from);
    const retry = (await old) as unknown as { data: typeof data; error: typeof error };
    data = retry.data;
    error = retry.error;
  }
  if (error) return { ok: false, message: "活動日を読み込めませんでした。インターネットの接続を確認して、再読み込みしてください。" };
  return { ok: true, data: ((data ?? []) as unknown as DayRow[]).map(dayToSummary) };
}

/** 1日分（なければ null） */
export async function loadDay(date: string): Promise<LoadResult<DaySummary | null>> {
  if (!isSupabaseConfigured) {
    return { ok: true, data: SAMPLE_DAYS.find((d) => d.date === date) ?? null };
  }
  const supabase = await createClient();
  let { data, error } = await supabase.from("activity_days").select(DAY_SELECT).eq("date", date).maybeSingle();
  if (error) {
    const retry = (await supabase.from("activity_days").select(DAY_SELECT_OLD).eq("date", date).maybeSingle()) as unknown as {
      data: typeof data;
      error: typeof error;
    };
    data = retry.data;
    error = retry.error;
  }
  if (error) return { ok: false, message: "活動日を読み込めませんでした。インターネットの接続を確認して、再読み込みしてください。" };
  return { ok: true, data: data ? dayToSummary(data as unknown as DayRow) : null };
}

/** ログイン中の人が管理者か（お試しモードでは管理者として扱う） */
export async function currentIsAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

export type Role = "admin" | "staff" | "viewer";

/** ログイン中の人の権限（お試しモードでは管理者として扱う） */
export async function currentRole(): Promise<Role | null> {
  if (!isSupabaseConfigured) return "admin";
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_staff").maybeSingle();
  const role = (data as { role?: Role } | null)?.role;
  return role ?? null;
}

/** 指導者・審判の選択肢に出すスタッフ */
export interface StaffOption {
  id: string;
  name: string;
  is_active: boolean;
  can_coach: boolean;
  can_umpire: boolean;
  can_plate: boolean;
  can_base: boolean;
}

export async function loadStaffOptions(): Promise<StaffOption[]> {
  if (!isSupabaseConfigured) return SAMPLE_STAFF;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id,name,is_active,can_coach,can_umpire,can_plate,can_base")
    .order("name");
  return ((data ?? []) as StaffOption[]).sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export interface TournamentOption {
  id: string;
  name: string;
}

/** 登録してある大会名（表がまだ無い場合は空） */
export async function loadTournamentNames(): Promise<TournamentOption[]> {
  if (!isSupabaseConfigured) {
    return [{ id: "t1", name: "JJBF大会" }];
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("tournaments").select("id,name").order("created_at");
  if (error) return [];
  return (data ?? []) as TournamentOption[];
}
