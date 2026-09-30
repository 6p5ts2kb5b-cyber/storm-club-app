// 活動単位（トップ／アカデミー／STORM）1つ分のカード
import { DIVISION_LABEL, formatTime } from "@/lib/divisions";
import { checkUnit, LEVEL_EMOJI, worstLevel, type UnitSummary } from "@/lib/status";

export default function UnitCard({ unit, compact = false }: { unit: UnitSummary; compact?: boolean }) {
  const items = checkUnit(unit);
  const worst = worstLevel(unit);
  const firstGame = unit.games.find((g) => g.no === 1);

  return (
    <section className={`unit-card unit-card--${unit.division} level-${worst}`}>
      <header className="unit-card__head">
        <h3 className="unit-card__title">{DIVISION_LABEL[unit.division]}</h3>
        <span className={`pill pill--${worst}`}>
          {worst === "ok" ? "準備OK" : worst === "warn" ? "確認中あり" : "未確定あり"}
        </span>
      </header>

      <dl className="facts">
        <div>
          <dt>会場</dt>
          <dd>{unit.venue ?? <span className="muted">未定</span>}</dd>
        </div>
        {firstGame?.start && (
          <div>
            <dt>第1試合</dt>
            <dd>{formatTime(firstGame.start)}</dd>
          </div>
        )}
      </dl>

      {!compact && (
        <ul className="checks">
          {items.map((it) => (
            <li key={it.key} className={`check check--${it.level}`}>
              <span className="check__emoji" aria-hidden="true">{LEVEL_EMOJI[it.level]}</span>
              <span className="check__label">{it.label}</span>
              <span className="check__text">{it.text}</span>
            </li>
          ))}
          {unit.openPositions.map((p) => (
            <li key={p} className="check check--ng">
              <span className="check__emoji" aria-hidden="true">{LEVEL_EMOJI.ng}</span>
              <span className="check__label">審判配置</span>
              <span className="check__text">{p} 空き</span>
            </li>
          ))}
        </ul>
      )}

      {compact && (
        <p className="compact-summary">
          {items
            .filter((i) => i.level !== "none")
            .map((i) => `${LEVEL_EMOJI[i.level]}${i.label}`)
            .join("　")}
        </p>
      )}
    </section>
  );
}
