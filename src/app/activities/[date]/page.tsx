import Link from "next/link";
import ActivityFormButton from "@/components/ActivityFormButton";
import DivisionTabs from "@/components/DivisionTabs";
import SampleBanner from "@/components/SampleBanner";
import { currentRole, loadDay } from "@/lib/data";
import { autoModeForDate, formatDateLong } from "@/lib/divisions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const demo = !isSupabaseConfigured;
  const [result, role] = await Promise.all([valid ? loadDay(date) : Promise.resolve(null), currentRole()]);
  const isAdmin = role === "admin";
  const canEdit = role === "admin" || role === "staff";
  const day = result && result.ok ? result.data : null;

  return (
    <div className="page">
      <Link href="/activities" className="back-link">‹ 活動一覧</Link>
      <header className="page-head page-head--row">
        <div>
          <h1 className="page-head__title">{valid ? formatDateLong(date) : "活動日"}</h1>
          {day && (
            <p className="page-head__sub">
              {day.activityType || "活動内容 未設定"}
              {day.note ? `　・　${day.note}` : ""}
            </p>
          )}
        </div>
        {day && isAdmin && (
          <ActivityFormButton label="編集" className="btn" day={day} defaultDate={date} demo={demo} />
        )}
      </header>
      {demo && <SampleBanner />}

      {result && !result.ok ? (
        <div className="empty">
          <p>🔴 {result.message}</p>
        </div>
      ) : day ? (
        <DivisionTabs key={day.date} units={day.units} isAdmin={isAdmin} canEdit={canEdit} demo={demo} />
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
