"use client";

// 審判の割り当て・集合時間の保存（ブラウザからSupabaseへ）
import { createClient } from "./supabase/client";
import { type Position, SYSTEM_POSITIONS, type UmpireSystem } from "./umpire";

export type UmpireResult = { ok: true; id?: string } | { ok: false; message: string };

function explain(err: { message?: string; code?: string } | null | undefined, adminOnly = false): string {
  const message = err?.message ?? "";
  if (err?.code === "42501" || /row-level security|permission/i.test(message))
    return adminOnly ? "この設定は管理者だけが変更できます。" : "閲覧のみの権限では変更できません。";
  if (/fetch|network/i.test(message)) return "インターネットにつながっていません。電波の良い場所でもう一度押してください。";
  return "保存できませんでした。時間をおいてもう一度お試しください。";
}

/** 審判の枠に人を入れる（staffId か 相手チーム）。who が null なら空きに戻す */
export async function setSlot(
  gameId: string,
  position: Position,
  who: { staffId: string } | { opponent: true } | null,
): Promise<UmpireResult> {
  const supabase = createClient();
  if (!who) {
    const { error } = await supabase.from("umpire_slots").delete().eq("game_id", gameId).eq("position", position);
    return error ? { ok: false, message: explain(error) } : { ok: true };
  }
  const values: { game_id: string; position: Position; staff_id: string | null; is_opponent: boolean } =
    "staffId" in who
      ? { game_id: gameId, position, staff_id: who.staffId, is_opponent: false }
      : { game_id: gameId, position, staff_id: null, is_opponent: true };
  const { data, error } = await supabase
    .from("umpire_slots")
    .upsert(values, { onConflict: "game_id,position" })
    .select("id")
    .single();
  if (error) return { ok: false, message: explain(error) };
  return { ok: true, id: (data as { id: string } | null)?.id };
}

/** 試合の人数制（1〜4人制）を変える。使わなくなったポジションの割り当ては消す */
export async function setGameSystem(gameId: string, system: UmpireSystem): Promise<UmpireResult> {
  const supabase = createClient();
  const { error } = await supabase.from("games").update({ umpire_system: system }).eq("id", gameId);
  if (error) return { ok: false, message: explain(error, true) };
  const keep = SYSTEM_POSITIONS[system];
  const { error: delError } = await supabase
    .from("umpire_slots")
    .delete()
    .eq("game_id", gameId)
    .not("position", "in", `(${keep.join(",")})`);
  return delError ? { ok: false, message: explain(delError) } : { ok: true };
}

/** 活動全体の「何分前集合か」と、手動の審判集合時間（null なら自動計算に戻す） */
export async function saveUnitGather(unitId: string, offset: number, manual: string | null): Promise<UmpireResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("activity_units")
    .update({ umpire_offset_min: offset, umpire_gather_time: manual })
    .eq("id", unitId);
  return error ? { ok: false, message: explain(error, true) } : { ok: true };
}

/** 審判一人の集合時間の設定。すべて空なら設定を消して、活動全体の設定に合わせる */
export async function savePerson(
  unitId: string,
  staffId: string,
  values: { offsetMin: number | null; gatherTime: string | null; note: string | null },
): Promise<UmpireResult> {
  const supabase = createClient();
  if (values.offsetMin === null && !values.gatherTime && !values.note) {
    const { error } = await supabase.from("umpire_people").delete().eq("unit_id", unitId).eq("staff_id", staffId);
    return error ? { ok: false, message: explain(error, true) } : { ok: true };
  }
  const { error } = await supabase.from("umpire_people").upsert(
    {
      unit_id: unitId,
      staff_id: staffId,
      offset_min: values.offsetMin,
      gather_time: values.gatherTime || null,
      note: values.note,
    },
    { onConflict: "unit_id,staff_id" },
  );
  return error ? { ok: false, message: explain(error, true) } : { ok: true };
}
