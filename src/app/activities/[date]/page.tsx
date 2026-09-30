import Link from "next/link";
import DivisionTabs from "@/components/DivisionTabs";
import SampleBanner from "@/components/SampleBanner";
import { autoModeForDate, formatDateLong } from "@/lib/divisions";
import { SAMPLE_DAYS } from "@/lib/sample";

export default async function ActivityDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const day = SAMPLE_DAYS.find((d) => d.date === date);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <div className="page">
      <Link href="/activities" className="back-link">‹ 活動一覧</Link>
      <header className="page-head">
        <h1 className="page-head__title">{valid ? formatDateLong(date) : "活動日"}</h1>
        {day && <p className="page-head__sub">{day.activityType}</p>}
      </header>
      <SampleBanner />

      {day ? (
        <DivisionTabs units={day.units} />
      ) : (
        <div className="empty">
          <p>この日の活動はまだ登録されていません。</p>
          {valid && (
            <p className="muted">
              この日付は自動で「{autoModeForDate(date) === "split" ? "トップ・アカデミー" : "STORMクラブ"}」として登録されます（STEP4・5）。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
