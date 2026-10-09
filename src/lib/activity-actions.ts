"use client";

// 活動日の保存・削除（ブラウザからSupabaseへ）
import { DIVISION_LABEL, divisionsForMode, type DayMode, type Division } from "./divisions";
import { createClient } from "./supabase/client";

export const ACTIVITY_TYPES = ["練習試合", "公式戦", "大会", "練習", "その他"] as const;

/** 区分（トップ／アカデミー／STORM）ごとの入力内容 */
export interface UnitInput {
  activityType: string;
  venue: string;
  /** 選手集合時間 "07:30"（未設定なら空） */
  gatherTime: string;
  /** 審判の人数（0 = 不要） */
  umpireNeeded: number;
  /** 指導者（スタッフの番号） */
  coachIds: string[];
  note: string;
}

export interface DayInput {
  date: string;
  mode: DayMode;
  activityType: string;
  venues: Partial<Record<Division, string>>;
  note: string;
  /** 区分ごとの入力（あれば、上の activityType・venues より優先） */
  units?: Partial<Record<Division, UnitInput>>;
}

/** 区分ごとの入力を、データベースの列の形に直す */
function unitValues(input: DayInput, division: Division) {
  const u = input.units?.[division];
  if (!u) return { activity_type: input.activityType, venue: clean(input.venues[division]) };
  return {
    activity_type: u.activityType,
    venue: clean(u.venue),
    player_gather_time: u.gatherTime || null,
    umpire_required: u.umpireNeeded > 0,
    umpire_needed_count: Math.max(0, Math.min(8, u.umpireNeeded)),
    note: clean(u.note),
  };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

function explain(err: { message?: string; code?: string } | null | undefined): string {
  const message = err?.message ?? "";
  if (err?.code === "23505" || /duplicate|unique/i.test(message)) return "この日の活動はすでに登録されています。一覧からその日を開いて編集してください。";
  if (err?.code === "42501" || /row-level security|permission/i.test(message)) return "この操作は管理者だけができます。";
  if (/fetch|network/i.test(message)) return "インターネットにつながっていません。電波の良い場所でもう一度保存してください。";
  return "保存できませんでした。時間をおいてもう一度お試しください。";
}

const clean = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

/** 入力内容の確認 */
export function validateDay(input: DayInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "日付を選んでください。";
  if (input.units) {
    for (const d of divisionsForMode(input.mode)) {
      if (!input.units[d]?.activityType) return `${DIVISION_LABEL[d]}の活動内容を選んでください。`;
    }
    return null;
  }
  if (!input.activityType) return "活動内容を選んでください。";
  return null;
}

/** 新しい活動日を作成（その日の区分ぶんの活動単位も一緒に作ります） */
export async function createDay(input: DayInput): Promise<ActionResult> {
  const supabase = createClient();
  const { data: day, error } = await supabase
    .from("activity_days")
    .insert({ date: input.date, mode: input.mode, note: clean(input.note) })
    .select("id")
    .single();
  if (error || !day) return { ok: false, message: explain(error) };

  const rows = divisionsForMode(input.mode).map((division) => ({
    day_id: day.id,
    division,
    ...unitValues(input, division),
  }));
  const { data: made, error: unitError } = await supabase.from("activity_units").insert(rows).select("id,division");
  if (!unitError && input.units) {
    // 指導者も、区分ごとに入れる
    const coachRows = (made ?? []).flatMap((m: { id: string; division: Division }) =>
      (input.units?.[m.division]?.coachIds ?? []).map((staff_id) => ({ unit_id: m.id, staff_id })),
    );
    if (coachRows.length) await supabase.from("coach_assignments").insert(coachRows);
  }
  if (unitError) {
    // 途中で失敗したら、作りかけの活動日を消して元に戻す
    await supabase.from("activity_days").delete().eq("id", day.id);
    return { ok: false, message: explain(unitError) };
  }
  return { ok: true };
}

/**
 * 活動日の基本情報を更新。
 * 区分を切り替えたとき、足りない活動単位は新しく作ります。
 * 使わなくなった活動単位は消さずに残します（区分を戻すと、入力済みの内容が復活します）。
 */
export async function updateDay(dayId: string, input: DayInput): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("activity_days")
    .update({ date: input.date, mode: input.mode, note: clean(input.note) })
    .eq("id", dayId);
  if (error) return { ok: false, message: explain(error) };

  const { data: existing, error: readError } = await supabase
    .from("activity_units")
    .select("id,division,coach_assignments(staff_id)")
    .eq("day_id", dayId);
  if (readError) return { ok: false, message: explain(readError) };

  type Existing = { id: string; division: string; coach_assignments?: { staff_id: string }[] };
  for (const division of divisionsForMode(input.mode)) {
    const found = ((existing ?? []) as Existing[]).find((u) => u.division === division);
    const values = unitValues(input, division);
    let unitId = found?.id;
    if (found) {
      const { error: e } = await supabase.from("activity_units").update(values).eq("id", found.id);
      if (e) return { ok: false, message: explain(e) };
    } else {
      const { data: made, error: e } = await supabase
        .from("activity_units")
        .insert({ day_id: dayId, division, ...values })
        .select("id")
        .single();
      if (e) return { ok: false, message: explain(e) };
      unitId = made?.id;
    }
    // 指導者：増えた人を入れ、外した人を消す
    const want = input.units?.[division]?.coachIds;
    if (want && unitId) {
      const have = (found?.coach_assignments ?? []).map((c) => c.staff_id);
      const add = want.filter((id) => !have.includes(id));
      const drop = have.filter((id) => !want.includes(id));
      if (add.length) await supabase.from("coach_assignments").insert(add.map((staff_id) => ({ unit_id: unitId, staff_id })));
      for (const id of drop) await supabase.from("coach_assignments").delete().eq("unit_id", unitId).eq("staff_id", id);
    }
  }
  return { ok: true };
}

/** 活動日を削除（その日の入力内容もすべて消えます） */
export async function deleteDay(dayId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("activity_days").delete().eq("id", dayId);
  return error ? { ok: false, message: explain(error) } : { ok: true };
}

/** 審判の必要人数を保存 */
export async function saveUmpireNeed(unitId: string, required: boolean, needed: number): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("activity_units")
    .update({ umpire_required: required, umpire_needed_count: required ? needed : 0 })
    .eq("id", unitId);
  return error ? { ok: false, message: explain(error) } : { ok: true };
}

/** 選手集合時間・集合場所を保存（time は "07:30"、空なら未設定） */
export async function savePlayerGather(unitId: string, time: string | null, place: string | null): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("activity_units")
    .update({ player_gather_time: time || null, gather_place: place && place.trim() ? place.trim() : null })
    .eq("id", unitId);
  return error ? { ok: false, message: explain(error) } : { ok: true };
}

/** 大会の予備日（日付・表示名・会場）を保存（日付が空なら予備日なし） */
export async function saveReserve(
  unitId: string,
  date: string | null,
  name: string | null,
  venue: string | null,
  umpires: string[] = [],
  level: 1 | 2 = 1,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("activity_units")
    .update(
      level === 2
        ? {
            reserve2_date: date || null,
            reserve2_venue: date && venue && venue.trim() ? venue.trim() : null,
            reserve2_umpires: date && umpires.length ? umpires.join("、") : null,
          }
        : {
            reserve_umpires: date && umpires.length ? umpires.join("、") : null,
            reserve_date: date || null,
            reserve_name: date && name && name.trim() ? name.trim() : null,
            reserve_venue: date && venue && venue.trim() ? venue.trim() : null,
            // 予備日をなくしたら、予備日の予備日もなくす
            ...(date ? {} : { reserve2_date: null, reserve2_venue: null, reserve2_umpires: null }),
          },
    )
    .eq("id", unitId);
  if (error && /column|schema cache/i.test(error.message ?? "")) {
    return { ok: false, message: "データベースの更新（0013・0014・0017）がまだです。SQL Editor で supabase/setup_all.sql を実行してください。" };
  }
  return error ? { ok: false, message: explain(error) } : { ok: true };
}

/** 「大会しだいで変わる予定」を保存（name が空なら、通常の予定に戻す） */
export async function saveTournament(
  unitId: string,
  name: string | null,
  state: "pending" | "held" | "not_held" | "postponed" | "not_held_rest",
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("activity_units")
    .update({ tournament_name: name && name.trim() ? name.trim() : null, tournament_state: state })
    .eq("id", unitId);
  if (error && /column|schema cache/i.test(error.message ?? "")) {
    return { ok: false, message: "データベースの更新（0010〜0016）がまだです。SQL Editor で supabase/setup_all.sql を実行してください。" };
  }
  return error ? { ok: false, message: explain(error) } : { ok: true };
}

function explainCoach(err: { message?: string; code?: string } | null | undefined): string {
  const message = err?.message ?? "";
  if (err?.code === "23505" || /duplicate|unique/i.test(message)) return "この人はすでに参加になっています。";
  if (err?.code === "42501" || /row-level security|permission/i.test(message)) return "閲覧のみの権限では変更できません。";
  if (/fetch|network/i.test(message)) return "インターネットにつながっていません。電波の良い場所でもう一度押してください。";
  return "保存できませんでした。時間をおいてもう一度お試しください。";
}

/** 指導者を参加にする／取り消す */
export async function setCoach(unitId: string, staffId: string, join: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = join
    ? await supabase.from("coach_assignments").insert({ unit_id: unitId, staff_id: staffId })
    : await supabase.from("coach_assignments").delete().eq("unit_id", unitId).eq("staff_id", staffId);
  // すでに登録済み（ほかの人が同時に押した）なら、結果は同じなので成功扱い
  if (error && join && (error.code === "23505" || /duplicate/i.test(error.message ?? ""))) return { ok: true };
  return error ? { ok: false, message: explainCoach(error) } : { ok: true };
}

// ---------------- 試合（STEP9） ----------------

export interface GameInput {
  start: string; // "09:00"（空なら未定）
  opponent: string;
  /** STORMが試合に出るか（false なら審判だけ担当） */
  stormPlays: boolean;
  /** STORMが出ない試合の、もう一方のチーム名 */
  opponent2: string;
  /** 「他チームが担当」の審判を出すチーム名 */
  umpireTeam: string;
  note: string;
}

export type GameSaveResult =
  | {
      ok: true;
      game: {
        id: string;
        no: number;
        start?: string;
        opponent?: string;
        stormPlays: boolean;
        opponent2?: string;
        umpireTeam?: string;
        note?: string;
      };
    }
  | { ok: false; message: string };

function explainGame(err: { message?: string; code?: string } | null | undefined): string {
  const message = err?.message ?? "";
  if (err?.code === "23505" || /duplicate|unique/i.test(message)) return "同じ番号の試合がすでにあります。画面を再読み込みしてから、もう一度お試しください。";
  if (err?.code === "42501" || /row-level security|permission/i.test(message)) return "試合の登録・変更は管理者だけができます。";
  if (/fetch|network/i.test(message)) return "インターネットにつながっていません。電波の良い場所でもう一度保存してください。";
  if (/column|schema cache/i.test(message)) return "データベースの更新（0009）がまだです。SQL Editor で supabase/setup_all.sql を実行してください。";
  return "保存できませんでした。時間をおいてもう一度お試しください。";
}

/** 試合を追加（id が null）または更新。新しい試合は最後の番号の次になります */
export async function saveGame(unitId: string, id: string | null, gameNo: number, input: GameInput): Promise<GameSaveResult> {
  const supabase = createClient();
  const values = {
    start_time: input.start || null,
    opponent: input.opponent.trim() || null,
    storm_plays: input.stormPlays,
    opponent2: input.stormPlays ? null : input.opponent2.trim() || null,
    umpire_team: input.umpireTeam.trim() || null,
    note: input.note.trim() || null,
  };
  const cols = "id,game_no,start_time,opponent,storm_plays,opponent2,umpire_team,note";
  const { data, error } = id
    ? await supabase.from("games").update(values).eq("id", id).select(cols).single()
    : await supabase.from("games").insert({ unit_id: unitId, game_no: gameNo, ...values }).select(cols).single();
  if (error || !data) return { ok: false, message: explainGame(error) };
  const row = data as {
    id: string;
    game_no: number;
    start_time: string | null;
    opponent: string | null;
    storm_plays: boolean | null;
    opponent2: string | null;
    umpire_team: string | null;
    note: string | null;
  };
  return {
    ok: true,
    game: {
      id: row.id,
      no: row.game_no,
      start: row.start_time ? row.start_time.slice(0, 5) : undefined,
      opponent: row.opponent ?? undefined,
      stormPlays: row.storm_plays ?? true,
      opponent2: row.opponent2 ?? undefined,
      umpireTeam: row.umpire_team ?? undefined,
      note: row.note ?? undefined,
    },
  };
}

/** 試合を削除（後ろの試合の番号は自動で詰めます） */
export async function deleteGame(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_game", { p_game_id: id });
  return error ? { ok: false, message: explainGame(error) } : { ok: true };
}

/** 大会名を登録する（管理者だけ） */
export async function addTournamentName(name: string): Promise<ActionResult & { id?: string }> {
  const n = name.trim().slice(0, 40);
  if (!n) return { ok: false, message: "大会名を入力してください。" };
  const supabase = createClient();
  const { data, error } = await supabase.from("tournaments").insert({ name: n }).select("id").single();
  if (error && (error.code === "23505" || /duplicate/i.test(error.message ?? ""))) return { ok: true };
  if (error && /relation|schema cache|does not exist/i.test(error.message ?? "")) {
    return { ok: false, message: "データベースの更新（0015）がまだです。SQL Editor で supabase/setup_all.sql を実行してください。" };
  }
  return error ? { ok: false, message: explain(error) } : { ok: true, id: data?.id as string };
}

/** 登録した大会名を消す（管理者だけ。すでに使っている予定の名前はそのまま残ります） */
export async function removeTournamentName(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  return error ? { ok: false, message: explain(error) } : { ok: true };
}
