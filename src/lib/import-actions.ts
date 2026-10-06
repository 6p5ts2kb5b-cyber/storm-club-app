"use client";

// 読み取った下書きを、活動日として登録する
//   新しい日   … 活動日を作り、会場・集合時間・審判人数・試合を入れる
//   登録済みの日 … すでに入っている内容は変えず、空いている項目だけ埋める
import { createDay } from "./activity-actions";
import { DIVISION_LABEL, type DayMode, formatDateShort } from "./divisions";
import type { DraftUnit } from "./extract";
import type { DaySummary } from "./status";
import { createClient } from "./supabase/client";
import { timeMinus } from "./umpire";

export interface ImportReport {
  created: number;
  filled: number;
  skipped: string[];
  errors: string[];
}

export function groupDrafts(drafts: DraftUnit[]): { date: string; units: DraftUnit[] }[] {
  const map = new Map<string, DraftUnit[]>();
  for (const d of drafts) map.set(d.date, [...(map.get(d.date) ?? []), d]);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, units]) => ({ date, units }));
}

/** 審判集合時間は、第1試合からの自動計算と同じなら「自動」のままにしておく */
function manualUmpireGather(u: DraftUnit): string | null {
  if (!u.umpireGather) return null;
  const first = u.games.find((g) => g.start)?.start;
  if (first && timeMinus(first, 60) === u.umpireGather) return null;
  return u.umpireGather;
}

export async function saveImport(drafts: DraftUnit[], existing: DaySummary[]): Promise<ImportReport> {
  const supabase = createClient();
  const report: ImportReport = { created: 0, filled: 0, skipped: [], errors: [] };

  for (const group of groupDrafts(drafts)) {
    const label = formatDateShort(group.date);
    const mode: DayMode = group.units.some((u) => u.division !== "storm") ? "split" : "single";
    const before = existing.find((d) => d.date === group.date);

    // 1. 活動日を用意する
    if (!before) {
      const venues = Object.fromEntries(group.units.map((u) => [u.division, u.venue]));
      const r = await createDay({
        date: group.date,
        mode,
        activityType: group.units[0].activityType,
        venues,
        note: "",
      });
      if (!r.ok) {
        report.errors.push(`${label}：${r.message}`);
        continue;
      }
    }

    // 2. その日の活動単位（トップ／アカデミー／STORM）を読み込む
    const { data, error } = await supabase
      .from("activity_days")
      .select("id,mode,activity_units(id,division,venue,player_gather_time,umpire_required,note,games(id))")
      .eq("date", group.date)
      .single();
    if (error || !data) {
      report.errors.push(`${label}：登録した活動日を読み込めませんでした。`);
      continue;
    }
    const day = data as unknown as {
      mode: DayMode;
      activity_units: {
        id: string;
        division: string;
        venue: string | null;
        player_gather_time: string | null;
        umpire_required: boolean;
        note: string | null;
        games: { id: string }[];
      }[];
    };

    let touched = false;
    for (const u of group.units) {
      const unit = day.activity_units.find((x) => x.division === u.division);
      const usable = day.mode === "split" ? u.division !== "storm" : u.division === "storm";
      if (!unit || !usable) {
        report.skipped.push(`${label} ${DIVISION_LABEL[u.division]}：この日は区分が違うため反映しませんでした`);
        continue;
      }

      // 3. 項目を入れる（登録済みの日は空いているところだけ）
      const fresh = !before;
      const patch: Record<string, unknown> = {};
      if (u.venue && (fresh || !unit.venue)) patch.venue = u.venue;
      if (u.playerGather && (fresh || !unit.player_gather_time)) patch.player_gather_time = u.playerGather;
      if (u.umpireNeeded > 0 && (fresh || !unit.umpire_required)) {
        patch.umpire_required = true;
        patch.umpire_needed_count = u.umpireNeeded;
        const manual = manualUmpireGather(u);
        if (manual) patch.umpire_gather_time = manual;
      }
      if (u.note && (fresh || !unit.note)) patch.note = u.note;
      if (!fresh && u.activityType && !before?.activityType) patch.activity_type = u.activityType;

      if (Object.keys(patch).length) {
        const { error: e } = await supabase.from("activity_units").update(patch).eq("id", unit.id);
        if (e) {
          report.errors.push(`${label} ${DIVISION_LABEL[u.division]}：内容を保存できませんでした。`);
          continue;
        }
        touched = true;
      }

      // 4. 試合（まだ1試合も入っていないときだけ）
      if (u.games.length && unit.games.length === 0) {
        const rows = u.games.map((g, i) => ({
          unit_id: unit.id,
          game_no: i + 1,
          start_time: g.start || null,
          opponent: g.opponent || null,
        }));
        const { error: e } = await supabase.from("games").insert(rows);
        if (e) report.errors.push(`${label} ${DIVISION_LABEL[u.division]}：試合を保存できませんでした。`);
        else touched = true;
      } else if (u.games.length && unit.games.length > 0 && before) {
        report.skipped.push(`${label} ${DIVISION_LABEL[u.division]}：試合はすでに入っているため、変えていません`);
      }
    }

    if (!before) report.created += 1;
    else if (touched) report.filled += 1;
  }
  return report;
}
