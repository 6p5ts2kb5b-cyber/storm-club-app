// スコアボードの数字で表示する日付（例：12/5 土）
import { monthDay, weekdayLabel } from "@/lib/divisions";

export default function BigDate({ date, size = "lg" }: { date: string; size?: "xl" | "lg" | "sm" }) {
  const { month, day } = monthDay(date);
  const wd = weekdayLabel(date);
  const weekend = wd === "土" ? " is-sat" : wd === "日" ? " is-sun" : "";
  return (
    <span className={`bigdate bigdate--${size}`}>
      <span className="bigdate__num">
        {month}
        <span className="bigdate__sep">/</span>
        {day}
      </span>
      <span className={`bigdate__wd${weekend}`}>{wd}</span>
    </span>
  );
}
