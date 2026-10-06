// ホーム（ダッシュボード）
// 1. 次の活動：スコアボード（何が決まっていないかが、ランプでひと目で分かる）
// 2. 要確認：これからの活動で🔴🟡のものを、日付ごとにまとめて表示
// 3. その先の活動：ランプの列だけを並べた一覧
import Link from "next/link";
import BigDate from "@/components/BigDate";
import Lamp from "@/components/Lamp";
import SampleBanner from "@/components/SampleBanner";
import UnitCard from "@/components/UnitCard";
import { loadDays } from "@/lib/data";
import { daysFromToday, todayInTokyo } from "@/lib/divisions";
import { collectIssues, type Issue } from "@/lib/status";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

function untilLabel(n: number): string {
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  return `あと${n}日`;
}

/** 要確認を日付ごとにまとめる */
function groupByDate(issues: Issue[]): [string, Issue[]][] {
  const map = new Map<string, Issue[]>();
  for (const i of issues) map.set(i.date, [...(map.get(i.date) ?? []), i]);
  return [...map.entries()];
}

export default async function HomePage() {
  const today = todayInTokyo();
  const result = await loadDays(today);
  const upcoming = result.ok ? [...result.data].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const issues = collectIssues(upcoming);
  const ngCount = issues.filter((i) => i.level === "ng").length;
  const [next, ...rest] = upcoming;

  return (
    <div className="page page--home">
      <header className="home-head">
        <p className="home-head__today">
          今日 <BigDate date={today} size="sm" />
        </p>
        {upcoming.length > 0 && (
          <a href="#issues" className={`tally${ngCount ? " tally--ng" : issues.length ? " tally--warn" : " tally--ok"}`}>
            <Lamp level={ngCount ? "ng" : issues.length ? "warn" : "ok"} />
            {issues.length ? `要確認 ${issues.length}件` : "すべて準備OK"}
          </a>
        )}
      </header>

      {!isSupabaseConfigured && <SampleBanner />}
      {!result.ok && <p className="form-error">{result.message}</p>}

      {result.ok && upcoming.length === 0 && (
        <div className="empty empty--home">
          <p className="empty__title">これからの活動はまだありません</p>
          <p className="muted">活動日を登録すると、ここに準備の状況がスコアボードで表示されます。</p>
          <Link href="/activities" className="btn btn--primary">活動日を登録する</Link>
        </div>
      )}

      {/* 1. 次の活動 */}
      {next && (
        <section className="next" aria-labelledby="next-title">
          <Link href={`/activities/${next.date}`} className="next__link">
            <div className="next__head">
              <h2 id="next-title" className="sr-only">
                次の活動
              </h2>
              <BigDate date={next.date} />
              <span className="next__meta">
                <span className="next__until">{untilLabel(daysFromToday(next.date, today))}</span>
                <span className="next__type">{next.activityType || "活動"}</span>
              </span>
              <span className="next__open">詳細</span>
            </div>
          </Link>
          <div className={`next__boards next__boards--${next.units.length}`}>
            {next.units.map((u) => (
              <UnitCard key={u.division} unit={u} />
            ))}
          </div>
        </section>
      )}

      {/* 2. 要確認 */}
      {upcoming.length > 0 && (
        <section className="block" id="issues" aria-labelledby="issues-title">
          <div className="block__head">
            <h2 id="issues-title" className="block__title">
              要確認
            </h2>
            <span className="block__count">{issues.length}件</span>
          </div>

          {issues.length === 0 ? (
            <p className="all-clear">
              <Lamp level="ok" />
              これからの活動は、すべて準備ができています。
            </p>
          ) : (
            <div className="issue-days">
              {groupByDate(issues).map(([date, list]) => (
                <Link key={date} href={`/activities/${date}`} className="issue-day">
                  <span className="issue-day__date">
                    <BigDate date={date} size="sm" />
                  </span>
                  <ul className="issue-day__list">
                    {list.map((iss, i) => (
                      <li key={i} className={`issue issue--${iss.level}`}>
                        <Lamp level={iss.level} />
                        <span className="issue__text">{iss.text}</span>
                        {iss.division !== "storm" && (
                          <span className={`div-tag div-tag--${iss.division}`}>{iss.divisionLabel}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <span className="issue__chev" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. その先の活動 */}
      {rest.length > 0 && (
        <section className="block" aria-labelledby="later-title">
          <div className="block__head">
            <h2 id="later-title" className="block__title">
              その先の活動
            </h2>
          </div>
          <ul className="later">
            {rest.map((d) => (
              <li key={d.date}>
                <Link href={`/activities/${d.date}`} className="later__row">
                  <BigDate date={d.date} size="sm" />
                  <span className="later__units">
                    {d.units.map((u) => (
                      <UnitCard key={u.division} unit={u} compact />
                    ))}
                  </span>
                  <span className="issue__chev" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
