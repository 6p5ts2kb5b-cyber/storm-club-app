// ホーム（ダッシュボード）
// いちばん上に「要確認（🔴🟡）」、その下に「次の活動」「これからの活動」を並べます。
import Link from "next/link";
import SampleBanner from "@/components/SampleBanner";
import UnitCard from "@/components/UnitCard";
import { daysFromToday, formatDateLong, formatDateShort, todayInTokyo } from "@/lib/divisions";
import { SAMPLE_DAYS } from "@/lib/sample";
import { collectIssues, LEVEL_EMOJI } from "@/lib/status";

export const dynamic = "force-dynamic";

function untilLabel(n: number): string {
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  return `あと${n}日`;
}

export default function HomePage() {
  const today = todayInTokyo();
  const upcoming = SAMPLE_DAYS.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const issues = collectIssues(upcoming);
  const [next, ...rest] = upcoming;

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-head__sub">{formatDateLong(today)}</p>
        <h1 className="page-head__title">ホーム</h1>
      </header>

      <SampleBanner />

      {/* 要確認：このアプリで一番大事な場所 */}
      <section className="block" aria-labelledby="issues-title">
        <div className="block__head">
          <h2 id="issues-title" className="block__title">要確認</h2>
          <span className={`count-badge${issues.length ? " count-badge--ng" : ""}`}>{issues.length}件</span>
        </div>

        {issues.length === 0 ? (
          <p className="all-clear">🟢 すべて準備できています</p>
        ) : (
          <ul className="issue-list">
            {issues.map((iss, i) => (
              <li key={`${iss.date}-${iss.division}-${i}`}>
                <Link href={`/activities/${iss.date}`} className={`issue issue--${iss.level}`}>
                  <span className="issue__when">
                    {formatDateShort(iss.date)}
                    <span className={`div-tag div-tag--${iss.division}`}>{iss.divisionLabel}</span>
                  </span>
                  <span className="issue__text">
                    <span aria-hidden="true">{LEVEL_EMOJI[iss.level]}</span> {iss.text}
                  </span>
                  <span className="issue__chev" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 次の活動 */}
      {next && (
        <section className="block" aria-labelledby="next-title">
          <div className="block__head">
            <h2 id="next-title" className="block__title">次の活動</h2>
            <span className="count-badge">{untilLabel(daysFromToday(next.date, today))}</span>
          </div>
          <Link href={`/activities/${next.date}`} className="day-card day-card--next">
            <div className="day-card__date">
              {formatDateLong(next.date)}
              <span className="day-card__type">{next.activityType}</span>
            </div>
            <div className="unit-grid">
              {next.units.map((u) => (
                <UnitCard key={u.division} unit={u} />
              ))}
            </div>
          </Link>
        </section>
      )}

      {/* これからの活動 */}
      {rest.length > 0 && (
        <section className="block" aria-labelledby="later-title">
          <div className="block__head">
            <h2 id="later-title" className="block__title">これからの活動</h2>
          </div>
          <div className="day-list">
            {rest.map((d) => (
              <Link key={d.date} href={`/activities/${d.date}`} className="day-card">
                <div className="day-card__date">
                  {formatDateLong(d.date)}
                  <span className="day-card__type">{d.activityType}</span>
                </div>
                <div className="unit-grid">
                  {d.units.map((u) => (
                    <UnitCard key={u.division} unit={u} compact />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
