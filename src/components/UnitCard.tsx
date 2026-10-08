// 活動単位（トップ／アカデミー／STORM）1つ分の「スコアボード」
//   上段：区分名と、まだ決まっていない項目の数
//   中段：時刻のマス目（選手集合・審判集合・第1〜N試合）＝スコアボードのイニング欄
//   下段：項目ごとのランプ（緑＝決定・黄＝確認中・赤＝未確定）
import Lamp from "@/components/Lamp";
import { DIVISION_LABEL, formatTime } from "@/lib/divisions";
import { checkUnit, isRest, type Level, type UnitSummary, worstLevel } from "@/lib/status";

/** 時刻のマス目に並べる内容 */
function lineScore(unit: UnitSummary) {
  const cells: { key: string; label: string; value?: string; need: boolean }[] = [
    { key: "player", label: "選手集合", value: unit.playerGatherTime, need: true },
  ];
  if (unit.umpireRequired) {
    cells.push({ key: "ump", label: "審判集合", value: unit.umpireGatherTime, need: true });
  }
  for (const g of [...unit.games].sort((a, b) => a.no - b.no)) {
    cells.push({ key: `g${g.no}`, label: `第${g.no}試合`, value: g.start, need: true });
  }
  return cells;
}

function stateText(levels: Level[], openCount: number, rest = false): { word: string; level: Level } {
  if (rest) return { word: "休み", level: "none" };
  const ng = levels.filter((l) => l === "ng").length + openCount;
  const warn = levels.filter((l) => l === "warn").length;
  if (ng > 0) return { word: `未確定 ${ng}`, level: "ng" };
  if (warn > 0) return { word: `確認中 ${warn}`, level: "warn" };
  return { word: "準備OK", level: "ok" };
}

export default function UnitCard({ unit, compact = false }: { unit: UnitSummary; compact?: boolean }) {
  const items = checkUnit(unit);
  const state = stateText(
    items.map((i) => i.level),
    unit.openPositions.length,
    isRest(unit),
  );
  const rest = isRest(unit);

  // 一覧用の小さい表示：区分名とランプの列だけ
  if (compact) {
    const worst = worstLevel(unit);
    return (
      <div className={`mini mini--${unit.division}`}>
        <span className="mini__name">{DIVISION_LABEL[unit.division]}</span>
        <span className="mini__lamps" aria-hidden="true">
          {items
            .filter((i) => i.level !== "none")
            .map((i, n) => (
              <Lamp key={i.key} level={i.level} index={n} />
            ))}
        </span>
        <span className={`mini__state txt-${worst}`}>{state.word}</span>
      </div>
    );
  }

  // 大会が実施されて「休み」の日：準備する項目は出さず、休みであることを大きく見せる
  if (rest) {
    return (
      <section className={`board board--${unit.division} board--rest`} aria-label={`${DIVISION_LABEL[unit.division]}は休み`}>
        <header className="board__head">
          <h3 className="board__name">{DIVISION_LABEL[unit.division]}</h3>
          <span className="board__state board__state--none">
            <Lamp level="none" />
            休み
          </span>
        </header>
        <div className="rest">
          <span className="rest__word">休み</span>
          <span className="rest__why">{unit.tournamentName}が実施されるため、この日の練習はありません。</span>
        </div>
      </section>
    );
  }

  const cells = lineScore(unit);
  // 時刻（選手集合・審判集合）は上のマス目に出ているので、ランプの列では省く
  const checks = items.filter((i) => i.key !== "player" && i.key !== "umpireGather");

  return (
    <section className={`board board--${unit.division}`} aria-label={`${DIVISION_LABEL[unit.division]}の準備状況`}>
      <header className="board__head">
        <h3 className="board__name">{DIVISION_LABEL[unit.division]}</h3>
        <span className={`board__state board__state--${state.level}`}>
          <Lamp level={state.level} />
          {state.word}
        </span>
      </header>

      {unit.tournamentName && (
        <p className={`board__cond board__cond--${unit.tournamentState ?? "pending"}`}>
          {unit.tournamentState === "not_held"
            ? `${unit.tournamentName}は実施されないので、練習です`
            : `${unit.tournamentName}が実施されたら休み／実施されなければ練習`}
        </p>
      )}

      <p className="board__venue">
        <span className="board__venue-label">{unit.tournamentName && unit.tournamentState !== "not_held" ? "練習の会場" : "会場"}</span>
        {unit.venue ?? <span className="board__dim">未定</span>}
      </p>

      <div className="linescore" role="list" aria-label="時刻">
        {cells.map((c) => (
          <div key={c.key} role="listitem" className={`ls${c.value ? "" : " ls--empty"}`}>
            <span className="ls__label">{c.label}</span>
            <span className="ls__num">{c.value ? formatTime(c.value) : "—"}</span>
          </div>
        ))}
      </div>

      <ul className="board__checks">
        {checks.map((it, n) => (
          <li key={it.key} className={`bc bc--${it.level}`}>
            <Lamp level={it.level} index={n} />
            <span className="bc__label">{it.label}</span>
            <span className="bc__text">{it.text}</span>
          </li>
        ))}
        {unit.openPositions.length > 0 && (
          <li className="bc bc--ng bc--wide">
            <Lamp level="ng" index={checks.length} />
            <span className="bc__label">審判の枠</span>
            <span className="bc__text">{unit.openPositions.join("・")} が空き</span>
          </li>
        )}
      </ul>
    </section>
  );
}
