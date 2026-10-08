import Link from "next/link";
import ActivityFormButton from "@/components/ActivityFormButton";
import BigDate from "@/components/BigDate";
import Lamp from "@/components/Lamp";
import SampleBanner from "@/components/SampleBanner";
import { currentIsAdmin, loadDays } from "@/lib/data";
import { DIVISION_LABEL, todayInTokyo } from "@/lib/divisions";
import { isRest, worstLevel } from "@/lib/status";
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
        <BigDate date={d.date} size="sm" />
        <span className="list-row__main">
          <span className="list-row__title">{d.activityType || "活動内容 未設定"}</span>
          <span className="list-row__tags">
            {d.units.map((u) => (
              <span key={u.division} className="unit-state">
                {isRest(u) ? <Lamp level="none" /> : <Lamp level={worstLevel(u)} labelled />}
                {DIVISION_LABEL[u.division]}
                {isRest(u) && <span className="rest-tag">休み</span>}
              </span>
            ))}
          </span>
        </span>
        <span className="issue__chev" aria-hidden="true" />
      </Link>
    </li>
  );

  return (
    <div className="page">
      <header className="page-head page-head--row">
        <h1 className="page-head__title">活動一覧</h1>
        {isAdmin && (
          <div className="page-head__actions">
            <Link href="/import" className="btn">
              読み取って登録
            </Link>
            <ActivityFormButton label="＋ 追加" defaultDate={today} demo={demo} />
          </div>
        )}
      </header>
      {demo && <SampleBanner />}

      {!result.ok ? (
        <div className="empty">
          <p className="form-error">{result.message}</p>
        </div>
      ) : days.length === 0 ? (
        <div className="empty">
          <p className="empty__title">まだ活動日が登録されていません</p>
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
