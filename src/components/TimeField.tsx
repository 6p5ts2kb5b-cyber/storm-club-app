"use client";

// iPhoneで押しやすい時刻入力
//   ・大きな数字をタップ → iPhone標準の時刻ホイール
//   ・よく使う時刻はボタン1回
//   ・「−15分／＋15分」で細かく調整
import { formatTime } from "@/lib/divisions";

/** "07:30" に分を足し引きする（0:00〜23:45の範囲） */
export function shiftTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 45, Math.max(0, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function TimeField({
  value,
  onChange,
  label,
  presets = [],
  disabled = false,
  baseForAdjust = "08:00",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  presets?: string[];
  disabled?: boolean;
  /** 未入力のときに±15分を押した場合の基準時刻 */
  baseForAdjust?: string;
}) {
  return (
    <div className="time-field">
      <div className="time-hero">
        <label className={`time-hero__input${value ? "" : " is-empty"}`}>
          <span className="sr-only">{label}</span>
          <input type="time" step={300} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
          <span className="time-hero__text" aria-hidden="true">
            {value ? formatTime(value) : "--:--"}
          </span>
        </label>
        {!disabled && (
          <div className="time-hero__adj">
            <button type="button" className="adj-btn" onClick={() => onChange(shiftTime(value || baseForAdjust, -15))}>
              −15分
            </button>
            <button type="button" className="adj-btn" onClick={() => onChange(shiftTime(value || baseForAdjust, 15))}>
              ＋15分
            </button>
          </div>
        )}
      </div>
      {!disabled && <p className="field__hint center">時刻の数字をタップすると、時刻ホイールで選べます</p>}

      {!disabled && presets.length > 0 && (
        <div className="preset-grid">
          {presets.map((v) => (
            <button
              key={v}
              type="button"
              className={`chip-btn${value === v ? " is-active" : ""}`}
              aria-pressed={value === v}
              onClick={() => onChange(v)}
            >
              {formatTime(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
