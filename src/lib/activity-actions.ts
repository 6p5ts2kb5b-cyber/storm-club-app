"use client";

// 活動日の保存・削除（ブラウザからSupabaseへ）
import { divisionsForMode, type DayMode, type Division } from "./divisions";
import { createClient } from "./supabase/client";

export const ACTIVITY_TYPES = ["練習試合", "公式戦", "大会", "練習", "その他"] as const;

export interface DayInput {
  date: string;
  mode: DayMode;
  activityType: string;
  venues: Partial<Record<Division, string>>;
  note: string;
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
    activity_type: input.activityType,
    venue: clean(input.venues[division]),
  }));
  const { error: unitError } = await supabase.from("activity_units").insert(rows);
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
    .select("id,division")
    .eq("day_id", dayId);
  if (readError) return { ok: false, message: explain(readError) };

  for (const division of divisionsForMode(input.mode)) {
    const found = (existing ?? []).find((u: { division: string }) => u.division === division);
    const values = { activity_type: input.activityType, venue: clean(input.venues[division]) };
    const { error: e } = found
      ? await supabase.from("activity_units").update(values).eq("id", found.id)
      : await supabase.from("activity_units").insert({ day_id: dayId, division, ...values });
    if (e) return { ok: false, message: explain(e) };
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
