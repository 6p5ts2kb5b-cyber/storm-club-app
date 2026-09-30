import Link from "next/link";
import SampleBanner from "@/components/SampleBanner";
import { DIVISION_LABEL, formatDateLong } from "@/lib/divisions";
import { SAMPLE_DAYS } from "@/lib/sample";
import { LEVEL_EMOJI, worstLevel } from "@/lib/status";

export default function ActivitiesPage() {
  const days = [...SAMPLE_DAYS].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="page">
      <header className="page-head page-head--row">
        <h1 className="page-head__title">活動一覧</h1>
        <button type="button" className="btn btn--primary" disabled title="STEP4で使えるようになります">
          ＋ 活動日を追加
        </button>
      </header>
      <SampleBanner />

      <ul className="list">
        {days.map((d) => (
          <li key={d.date}>
            <Link href={`/activities/${d.date}`} className="list-row">
              <span className="list-row__main">
                <span className="list-row__title">{formatDateLong(d.date)}</span>
                <span className="list-row__sub">{d.activityType}</span>
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
        ))}
      </ul>
    </div>
  );
}
