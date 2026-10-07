import Link from "next/link";
import ActivityFormButton from "@/components/ActivityFormButton";
import BigDate from "@/components/BigDate";
import DivisionTabs from "@/components/DivisionTabs";
import SampleBanner from "@/components/SampleBanner";
import { currentRole, loadDay, loadStaffOptions } from "@/lib/data";
import { autoModeForDate } from "@/lib/divisions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const demo = !isSupabaseConfigured;
  const [result, role, staff] = await Promise.all([
    valid ? loadDay(date) : Promise.resolve(null),
    currentRole(),
    loadStaffOptions(),
  ]);
  const isAdmin = role === "admin";
  const canEdit = role === "admin" || role === "staff";
  const day = result && result.ok ? result.data : null;

  return (
    <div className="page">
      <header className="dayhead">
        <Link href="/activities" className="back-link">
          ‹ 活動一覧
        </Link>
        <div className="dayhead__row">
          <h1>{valid ? <BigDate date={date} size="xl" /> : "活動日"}</h1>
          {day && isAdmin && (
            <ActivityFormButton label="編集" className="btn" day={day} defaultDate={date} demo={demo} />
          )}
        </div>
        {day && (
          <p className="dayhead__meta">
            {day.activityType || "活動内容 未設定"}
            {day.note ? `　${day.note}` : ""}
          </p>
        )}
      </header>
      {demo && <SampleBanner />}

      {result && !result.ok ? (
        <div className="empty">
          <p className="form-error">{result.message}</p>
        </div>
      ) : day ? (
        <DivisionTabs key={day.date} date={day.date} units={day.units} staff={staff} isAdmin={isAdmin} canEdit={canEdit} demo={demo} />
      ) : (
        <div className="empty">
          <p>この日の活動はまだ登録されていません。</p>
          {valid && (
            <p className="muted">
              登録すると、自動で「{autoModeForDate(date) === "split" ? "トップ・アカデミー" : "STORMクラブ"}」になります（あとから変更できます）。
            </p>
          )}
          {valid && isAdmin && (
            <ActivityFormButton label="＋ この日に活動を登録" defaultDate={date} demo={demo} />
          )}
        </div>
      )}
    </div>
  );
}
