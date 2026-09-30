"use client";

// 月間カレンダー
// 活動日に印を付け、タップするとその日の詳細へ移動します。
import Link from "next/link";
import { useState } from "react";
import { autoModeForDate, weekdayIndex } from "@/lib/divisions";
import type { Level } from "@/lib/status";

export interface CalendarMark {
  date: string;
  mode: "split" | "single";
  level: Level;
}

const WEEK_HEAD = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function MonthCalendar({ today, marks }: { today: string; marks: CalendarMark[] }) {
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));

  const first = `${year}-${pad(month)}-01`;
  const startWeekday = weekdayIndex(first);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const markMap = new Map(marks.map((m) => [m.date, m]));
  const splitMonth = autoModeForDate(first) === "split";

  function move(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="cal">
      <div className="cal__bar">
        <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label="前の月">
          ‹
        </button>
        <div className="cal__title">
          {year}年{month}月
          <span className="cal__mode">{splitMonth ? "トップ・アカデミー期間" : "STORMクラブ期間"}</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => move(1)} aria-label="次の月">
          ›
        </button>
      </div>

      <div className="cal__grid" role="grid">
        {WEEK_HEAD.map((w, i) => (
          <div key={w} className={`cal__wd${i === 0 ? " is-sun" : i === 6 ? " is-sat" : ""}`} role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} className="cal__cell cal__cell--empty" />;
          const mark = markMap.get(date);
          const wd = i % 7;
          const cls = `cal__cell${date === today ? " is-today" : ""}${wd === 0 ? " is-sun" : wd === 6 ? " is-sat" : ""}${mark ? " has-activity" : ""}`;
          const inner = (
            <>
              <span className="cal__num">{Number(date.slice(8, 10))}</span>
              {mark && (
                <span className="cal__dots">
                  {mark.mode === "split" ? (
                    <>
                      <span className="dot dot--top" title="トップ" />
                      <span className="dot dot--academy" title="アカデミー" />
                    </>
                  ) : (
                    <span className="dot dot--storm" title="STORMクラブ" />
                  )}
                  {mark.level === "ng" && <span className="cal__alert" aria-label="未確定あり">!</span>}
                </span>
              )}
            </>
          );
          return mark ? (
            <Link key={date} href={`/activities/${date}`} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={date} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      <ul className="cal__legend">
        <li><span className="dot dot--storm" /> STORM</li>
        <li><span className="dot dot--top" /> トップ</li>
        <li><span className="dot dot--academy" /> アカデミー</li>
        <li><span className="cal__alert">!</span> 未確定あり</li>
      </ul>
    </div>
  );
}
