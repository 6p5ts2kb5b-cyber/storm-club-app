import MonthCalendar, { type CalendarMark } from "@/components/MonthCalendar";
import SampleBanner from "@/components/SampleBanner";
import { todayInTokyo } from "@/lib/divisions";
import { loadDays } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { worstLevel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const result = await loadDays();
  const days = result.ok ? result.data : [];
  const marks: CalendarMark[] = days.map((d) => ({
    date: d.date,
    mode: d.mode,
    level: d.units.some((u) => worstLevel(u) === "ng") ? "ng" : d.units.some((u) => worstLevel(u) === "warn") ? "warn" : "ok",
  }));

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-head__title">カレンダー</h1>
      </header>
      {!isSupabaseConfigured && <SampleBanner />}
      {!result.ok && <p className="form-error">{result.message}</p>}
      <MonthCalendar today={todayInTokyo()} marks={marks} />
    </div>
  );
}
