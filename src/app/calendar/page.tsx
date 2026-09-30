import MonthCalendar, { type CalendarMark } from "@/components/MonthCalendar";
import SampleBanner from "@/components/SampleBanner";
import { todayInTokyo } from "@/lib/divisions";
import { SAMPLE_DAYS } from "@/lib/sample";
import { worstLevel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const marks: CalendarMark[] = SAMPLE_DAYS.map((d) => ({
    date: d.date,
    mode: d.units.length > 1 ? "split" : "single",
    level: d.units.some((u) => worstLevel(u) === "ng") ? "ng" : d.units.some((u) => worstLevel(u) === "warn") ? "warn" : "ok",
  }));

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-head__title">カレンダー</h1>
      </header>
      <SampleBanner step="STEP15" />
      <MonthCalendar today={todayInTokyo()} marks={marks} />
    </div>
  );
}
