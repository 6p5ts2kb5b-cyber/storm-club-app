import Link from "next/link";
import ActivityFormButton from "@/components/ActivityFormButton";
import Lamp from "@/components/Lamp";
import SampleBanner from "@/components/SampleBanner";
import { currentIsAdmin, loadDays } from "@/lib/data";
import { daysFromToday, DIVISION_LABEL, formatTime, monthDay, todayInTokyo, weekdayLabel } from "@/lib/divisions";
import { mdw, type ReserveInfo, reserveHeading, reservesByDate } from "@/lib/reserve";
import { isRest, restWhy, worstLevel } from "@/lib/status";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const today = todayInTokyo();
  const [result, isAdmin] = await Promise.all([loadDays(), currentIsAdmin()]);
  const demo = !isSupabaseConfigured;

  const days = result.ok ? result.data : [];
  const upcoming = days.filter((d) => d.date >= today);
  const past = days.filter((d) => d.date < today).reverse();

  const reserveMap = reservesByDate(days);
  type Item = { date: string; day?: (typeof days)[number]; reserves: ReserveInfo[] };
  const toItems = (list: typeof days): Item[] => list.map((d) => ({ date: d.date, day: d, reserves: reserveMap.get(d.date) ?? [] }));
  // 予定が登録されていなくても、予備日にあたる日は並べる
  const reserveOnly: Item[] = [];
  reserveMap.forEach((reserves, date) => {
    if (date >= today && !days.some((d) => d.date === date)) reserveOnly.push({ date, reserves });
  });
  const upcomingItems = [...toItems(upcoming), ...reserveOnly].sort((a, b) => a.date.localeCompare(b.date));
  const pastItems = toItems(past);

  const badge = (date: string) => {
    const n = daysFromToday(date, today);
    return n === 0 ? "今日" : n === 1 ? "明日" : n > 1 ? `${n}日後` : "";
  };

  const unitLines = (u: (typeof days)[number]["units"][number]) => {
    const place = u.venue || (u.groundState === "decided" ? u.groundName : undefined);
    const games = [...u.games].sort((a, b) => a.no - b.no);
    return (
      <>
        {isRest(u) ? (
          <p className="acard__rest">休養日<small>{restWhy(u)}</small></p>
        ) : (
          <dl className="acard__dl">
            {place && (<><dt>会場</dt><dd>{place}</dd></>)}
            {u.playerGatherTime && (
              <>
                <dt>集合</dt>
                <dd className="acard__gather">{formatTime(u.playerGatherTime)}{u.gatherPlace ? `　${u.gatherPlace}` : ""}</dd>
              </>
            )}
            {games.length > 0 && (
              <>
                <dt>試合</dt>
                <dd>
                  {games.slice(0, 4).map((g) => (
                    <span key={g.id ?? g.no} className={`acard__game${g.stormPlays === false ? " is-others" : ""}`}>
                      <b>{g.start ? formatTime(g.start) : "時間未定"}</b>
                      {g.stormPlays === false ? `${g.opponent || "未定"} 対 ${g.opponent2 || "未定"}（審判）` : `vs ${g.opponent || "未定"}`}
                    </span>
                  ))}
                  {games.length > 4 && <span className="acard__more">ほか{games.length - 4}試合</span>}
                </dd>
              </>
            )}
            {u.reserveDate && (
              <>
                <dt>予備日</dt>
                <dd>{mdw(u.reserveDate)}{u.reserveVenue ? `　${u.reserveVenue}` : ""}</dd>
              </>
            )}
          </dl>
        )}
        <span className="acard__lamps">
          {isRest(u) ? <Lamp level="none" /> : <Lamp level={worstLevel(u)} labelled />}
        </span>
      </>
    );
  };

  const card = (it: Item, isPast: boolean) => {
    const d = it.day;
    const { day } = monthDay(it.date);
    const wd = weekdayLabel(it.date);
    const when = isPast ? "" : badge(it.date);
    return (
      <li key={it.date}>
        <Link href={`/activities/${it.date}`} className={`acard${when === "今日" ? " is-today" : ""}`}>
          <span className="acard__date">
            <b>{day}</b>
            <i className={wd === "土" ? "is-sat" : wd === "日" ? "is-sun" : undefined}>{wd}</i>
          </span>
          <span className="acard__body">
            {when && <span className={`acard__badge${when === "今日" || when === "明日" ? " is-near" : ""}`}>{when}</span>}
            {it.reserves.map((r) => (
              <span key={`${r.fromDate}-${r.division}`} className="acard__reserve">☂ {reserveHeading(r)}</span>
            ))}
            {d ? (
              <>
                <span className="acard__title">
                  {d.activityType || "活動内容 未設定"}
                  {d.units.find((u) => u.tournamentName && !isRest(u)) && (
                    <small>{d.units.find((u) => u.tournamentName && !isRest(u))!.tournamentName}</small>
                  )}
                </span>
                {d.units.map((u) => (
                  <span key={u.division} className="acard__unit">
                    {d.units.length > 1 && <span className="acard__div">{DIVISION_LABEL[u.division]}</span>}
                    {unitLines(u)}
                  </span>
                ))}
              </>
            ) : (
              <span className="acard__rest">休養日<small>予備日（予定は未登録）</small></span>
            )}
          </span>
        </Link>
      </li>
    );
  };

  const renderGroups = (items: Item[], isPast: boolean) => {
    const groups = new Map<string, Item[]>();
    for (const it of items) groups.set(it.date.slice(0, 7), [...(groups.get(it.date.slice(0, 7)) ?? []), it]);
    return [...groups.entries()].map(([ym, list]) => (
      <section key={ym} className="amonth">
        <h2 className="amonth__head">
          <b>{Number(ym.slice(5, 7))}</b>月<small>{ym.slice(0, 4)}年・{list.length}件</small>
        </h2>
        <ul className="alist">{list.map((it) => card(it, isPast))}</ul>
      </section>
    ));
  };

  return (
    <div className="page">
      <header className="page-head page-head--row">
        <h1 className="page-head__title">活動一覧</h1>
        <div className="page-head__actions">
          <Link href="/print" className="btn">
            予定表を印刷
          </Link>
          {isAdmin && (
            <>
            <Link href="/import" className="btn">
              読み取って登録
            </Link>
            <ActivityFormButton label="＋ 追加" defaultDate={today} demo={demo} />
            </>
          )}
        </div>
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
          {upcomingItems.length ? renderGroups(upcomingItems, false) : <p className="muted">これからの予定はありません。</p>}
          {pastItems.length > 0 && (
            <details className="past">
              <summary>終わった活動（{pastItems.length}件）</summary>
              {renderGroups(pastItems, true)}
            </details>
          )}
        </>
      )}
    </div>
  );
}
