import Link from "next/link";
import ActivityFormButton from "@/components/ActivityFormButton";
import SampleBanner from "@/components/SampleBanner";
import { currentIsAdmin, loadDays } from "@/lib/data";
import { DIVISION_LABEL, formatDateLong, todayInTokyo } from "@/lib/divisions";
import { LEVEL_EMOJI, worstLevel } from "@/lib/status";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const today = todayInTokyo();
  const [result, isAdmin] = await Promise.all([loadDays(), currentIsAdmin()]);
  const demo = !isSupabaseConfigured;

  const days = result.ok ? result.data : [];
  const upcoming = days.filter((d) => d.date >= today);
  const past = days.filter((d) => d.date < today).reverse();

  const row = (d: (typeof days)[number]) => (
    <li key={d.date}>
      <Link href={`/activities/${d.date}`} className="list-row">
        <span className="list-row__main">
          <span className="list-row__title">{formatDateLong(d.date)}</span>
          <span className="list-row__sub">{d.activityType || "活動内容 未設定"}</span>
        </span>
        <span className="list-row__tags">
          {d.units.map((u) => (
            <span key={u.division} className={`div-tag div-tag--${u.division}`}>
              {LEVEL_EMOJI[worstLevel(u)]} {DIVISION_LABEL[u.division]}
            </span>
          ))}
        </span>
        <span className="issue__chev" aria-hidden="true">›</span>
      </Link>
    </li>
  );

  return (
    <div className="page">
      <header className="page-head page-head--row">
        <h1 className="page-head__title">活動一覧</h1>
        {isAdmin && <ActivityFormButton label="＋ 活動日を追加" defaultDate={today} demo={demo} />}
      </header>
      {demo && <SampleBanner />}

      {!result.ok ? (
        <div className="empty">
          <p>🔴 {result.message}</p>
        </div>
      ) : days.length === 0 ? (
        <div className="empty">
          <p>まだ活動日が登録されていません。</p>
          {isAdmin && <p className="muted">右上の「＋ 活動日を追加」から登録してください。</p>}
        </div>
      ) : (
        <>
          <h2 className="list-heading">これからの活動（{upcoming.length}件）</h2>
          {upcoming.length ? <ul className="list">{upcoming.map(row)}</ul> : <p className="muted">予定はありません。</p>}
          {past.length > 0 && (
            <details className="past">
              <summary>終わった活動（{past.length}件）</summary>
              <ul className="list">{past.map(row)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
