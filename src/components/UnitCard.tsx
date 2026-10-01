// 活動単位（トップ／アカデミー／STORM）1つ分のカード
import { DIVISION_LABEL, formatTime } from "@/lib/divisions";
import { checkUnit, LEVEL_EMOJI, worstLevel, type UnitSummary } from "@/lib/status";

export default function UnitCard({ unit, compact = false }: { unit: UnitSummary; compact?: boolean }) {
  const items = checkUnit(unit);
  const worst = worstLevel(unit);
  const games = [...unit.games].sort((a, b) => a.no - b.no);

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
        {unit.playerGatherTime && (
          <div>
            <dt>選手集合</dt>
            <dd>{formatTime(unit.playerGatherTime)}</dd>
          </div>
        )}
      </dl>

      {games.length > 0 && (
        <ul className="game-strip" aria-label="試合の開始時間">
          {games.map((g) => (
            <li key={g.id ?? g.no} className={g.start ? "" : "is-empty"}>
              <span className="game-strip__no">第{g.no}試合</span>
              <span className="game-strip__time">{g.start ? formatTime(g.start) : "未定"}</span>
            </li>
          ))}
        </ul>
      )}

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
