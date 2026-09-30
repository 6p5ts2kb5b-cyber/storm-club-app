"use client";

// グラウンド候補の保存・削除（ブラウザからSupabaseへ）
import type { Ground, GroundInput } from "./grounds";
import { createClient } from "./supabase/client";

export type GroundResult = { ok: true; ground?: Ground } | { ok: false; message: string };

const COLUMNS = "id,school_name,ground_name,school_use,storm_use,status,note";

function explain(err: { message?: string; code?: string } | null | undefined): string {
  const message = err?.message ?? "";
  if (err?.code === "23505" || /grounds_one_decided|duplicate|unique/i.test(message)) return "使用決定にできるグラウンドは1校だけです。";
  if (err?.code === "42501" || /row-level security|permission/i.test(message)) return "閲覧のみの権限では変更できません。";
  if (/fetch|network/i.test(message)) return "インターネットにつながっていません。電波の良い場所でもう一度保存してください。";
  return "保存できませんでした。時間をおいてもう一度お試しください。";
}

export function validateGround(input: GroundInput): string | null {
  if (!input.school_name.trim()) return "学校名を入力してください。";
  return null;
}

const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);

/** ほかの「使用決定」を「使用可能」に戻す（決定は1校だけにするため） */
async function releaseOtherDecided(unitId: string, keepId: string | null) {
  const supabase = createClient();
  let q = supabase.from("grounds").update({ status: "available" }).eq("unit_id", unitId).eq("status", "decided");
  if (keepId) q = q.neq("id", keepId);
  return q;
}

/** 追加（id が null）または更新 */
export async function saveGround(unitId: string, id: string | null, input: GroundInput): Promise<GroundResult> {
  const supabase = createClient();
  const values = {
    school_name: input.school_name.trim(),
    ground_name: clean(input.ground_name),
    school_use: input.school_use,
    storm_use: input.storm_use,
    status: input.status,
    note: clean(input.note),
  };

  if (values.status === "decided") {
    const { error } = await releaseOtherDecided(unitId, id);
    if (error) return { ok: false, message: explain(error) };
  }

  const { data, error } = id
    ? await supabase.from("grounds").update(values).eq("id", id).select(COLUMNS).single()
    : await supabase.from("grounds").insert({ unit_id: unitId, ...values }).select(COLUMNS).single();
  if (error || !data) return { ok: false, message: explain(error) };
  return { ok: true, ground: data as Ground };
}

export async function deleteGround(id: string): Promise<GroundResult> {
  const supabase = createClient();
  const { error } = await supabase.from("grounds").delete().eq("id", id);
  return error ? { ok: false, message: explain(error) } : { ok: true };
}
