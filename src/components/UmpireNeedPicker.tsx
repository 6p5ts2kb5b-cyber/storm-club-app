"use client";

// 審判の必要人数を選ぶ欄（不要／1〜8名）
// 小さな入力欄ではなく、指で押しやすい大きなボタンで選びます。
import { MAX_UMPIRES } from "@/lib/status";

export default function UmpireNeedPicker({
  required,
  needed,
  assigned,
  onChange,
}: {
  required: boolean;
  needed: number;
  assigned: number;
  onChange: (required: boolean, needed: number) => void;
}) {
  const short = Math.max(0, needed - assigned);
  const counts = Array.from({ length: MAX_UMPIRES }, (_, i) => i + 1);

  return (
    <section className="panel">
      <h2 className="panel__title">審判の必要人数</h2>

      <div className="count-grid" role="radiogroup" aria-label="審判の必要人数">
        <button
          type="button"
          role="radio"
          aria-checked={!required}
          className={`count-btn count-btn--none${!required ? " is-active" : ""}`}
          onClick={() => onChange(false, 0)}
        >
          不要
        </button>
        {counts.map((n) => {
          const on = required && needed === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              className={`count-btn${on ? " is-active" : ""}`}
              onClick={() => onChange(true, n)}
            >
              {n}
              <span className="count-btn__unit">名</span>
            </button>
          );
        })}
      </div>

      {required ? (
        <div className="need-summary">
          <div>
            <span className="need-summary__label">必要</span>
            <span className="need-summary__num">{needed}名</span>
          </div>
          <div>
            <span className="need-summary__label">決定済み</span>
            <span className="need-summary__num">{assigned}名</span>
          </div>
          <div className={short > 0 ? "is-ng" : "is-ok"}>
            <span className="need-summary__label">不足</span>
            <span className="need-summary__num">{short > 0 ? `あと${short}名` : "🟢 確定"}</span>
          </div>
        </div>
      ) : (
        <p className="muted">この日は審判の派遣はありません。</p>
      )}
    </section>
  );
}
