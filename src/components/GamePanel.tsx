"use client";

// 試合情報：第1〜第N試合の開始時間・対戦相手・備考
import { useState } from "react";
import TimeField, { shiftTime } from "@/components/TimeField";
import LeaguePanel from "@/components/LeaguePanel";
import ResultSend from "@/components/ResultSend";
import UmpirePicker from "@/components/UmpirePicker";
import { autoUmpire, dayTeamNames, umpireName } from "@/lib/umpire-team";
import { deleteGame, type GameInput, saveGame } from "@/lib/activity-actions";
import { formatTime } from "@/lib/divisions";
import { leagueRuleOf, OUR, parseRef } from "@/lib/league";
import type { Game } from "@/lib/status";
import { matchupText } from "@/lib/umpire";

const MAX_GAMES = 10;
/** 試合の結果（点数）を入れる行。空ならまだ */
function ScoreRow({
  left,
  right,
  sl,
  sr,
  ol,
  or,
  showOnBase,
  storm,
  called,
  inn,
  onChange,
}: {
  storm: boolean;
  called: boolean;
  inn: number | null;
  left: string;
  right: string;
  sl: number | null;
  sr: number | null;
  ol: number | null;
  or: number | null;
  showOnBase: boolean;
  onChange: (p: Partial<NonNullable<GameInput["result"]>>) => void;
}) {
  const box = (v: number | null, set: (n: number | null) => void, label: string) => (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      className="score-box"
      value={v ?? ""}
      onChange={(e) => set(e.target.value === "" ? null : Math.max(0, Math.min(99, Number(e.target.value))))}
      aria-label={label}
      placeholder="－"
    />
  );
  return (
    <div className="score-row">
      <span className="score-row__label">結果（試合が終わったら）</span>
      <div className="score-row__grid">
        <span className="score-row__team">{left}</span>
        <span />
        <span className="score-row__team">{right}</span>
        {box(sl, (n) => onChange({ scoreA: n }), `${left}の得点`)}
        <span className="score-row__dash">−</span>
        {box(sr, (n) => onChange({ scoreB: n }), `${right}の得点`)}
        {showOnBase && (
          <>
            <span className="score-row__sub">出塁数</span>
            <span />
            <span className="score-row__sub">出塁数</span>
            {box(ol, (n) => onChange({ onBaseA: n }), `${left}の出塁数`)}
            <span className="score-row__dash">−</span>
            {box(or, (n) => onChange({ onBaseB: n }), `${right}の出塁数`)}
          </>
        )}
      </div>
      {storm && (
        <div className="score-row__storm">
          <label>
            <input type="checkbox" checked={called} onChange={(e) => onChange({ called: e.target.checked })} /> コールドゲーム（勝ち点＋1）
          </label>
          <label>
            回数{" "}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={7}
              className="score-box score-box--inn"
              value={inn ?? ""}
              placeholder="7"
              onChange={(e) => onChange({ innings: e.target.value === "" ? null : Math.max(1, Math.min(7, Number(e.target.value))) })}
              aria-label="試合の回数"
            />{" "}
            回まで（7回なら空のまま）
          </label>
        </div>
      )}
    </div>
  );
}

type Result = NonNullable<GameInput["result"]>;

// ランニングスコア（回ごとの点）の入力。入れると合計が上の「結果」に自動で入る
function LineEditor({
  left,
  right,
  g,
  onChange,
}: {
  left: string;
  right: string;
  g: Result;
  onChange: (p: Partial<Result>) => void;
}) {
  const lh = g.lineA;
  const la = g.lineB;
  const [open, setOpen] = useState(lh.some((v) => v != null) || la.some((v) => v != null));
  const [cols, setCols] = useState(Math.max(7, lh.length, la.length));
  const first = g.firstBat === "b" ? "r" : "l";
  // 先攻を上の段に
  const rows: { side: "l" | "r"; name: string; vals: (number | null)[] }[] =
    first === "l"
      ? [
          { side: "l", name: left, vals: lh },
          { side: "r", name: right, vals: la },
        ]
      : [
          { side: "r", name: right, vals: la },
          { side: "l", name: left, vals: lh },
        ];
  const sum = (v: (number | null)[]) => (v.some((x) => x != null) ? v.reduce<number>((t, x) => t + (x ?? 0), 0) : null);
  const setCell = (side: "l" | "r", i: number, v: number | null) => {
    const cur = [...(side === "l" ? lh : la)];
    while (cur.length < cols) cur.push(null);
    cur[i] = v;
    // 後ろの空いた回は切る
    while (cur.length && cur[cur.length - 1] == null) cur.pop();
    const nl = side === "l" ? cur : lh;
    const nr = side === "r" ? cur : la;
    onChange({ lineA: nl, lineB: nr, scoreA: sum(nl) ?? g.scoreA, scoreB: sum(nr) ?? g.scoreB });
  };
  if (!open)
    return (
      <button type="button" className="line-open" onClick={() => setOpen(true)}>
        ＋ ランニングスコア（回ごとの点）を入れる
      </button>
    );
  return (
    <div className="line-ed">
      <div className="line-ed__row">
        <span className="score-row__label">先攻</span>
        <div className="seg seg--2" role="group" aria-label="先攻">
          <button type="button" aria-pressed={first === "l"} className={`seg__btn${first === "l" ? " is-active" : ""}`} onClick={() => onChange({ firstBat: "a" })}>
            {left}
          </button>
          <button type="button" aria-pressed={first === "r"} className={`seg__btn${first === "r" ? " is-active" : ""}`} onClick={() => onChange({ firstBat: "b" })}>
            {right}
          </button>
        </div>
      </div>
      <div className="line-ed__scroll">
        <table className="line-ed__table">
          <thead>
            <tr>
              <th />
              {Array.from({ length: cols }, (_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
              <th>計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.side}>
                <th className="line-ed__team">{r.name}</th>
                {Array.from({ length: cols }, (_, i) => (
                  <td key={i}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={30}
                      value={r.vals[i] ?? ""}
                      placeholder="－"
                      aria-label={`${r.name} ${i + 1}回`}
                      onChange={(e) =>
                        setCell(r.side, i, e.target.value === "" ? null : Math.max(0, Math.min(30, Number(e.target.value))))
                      }
                    />
                  </td>
                ))}
                <td className="line-ed__sum">{sum(r.vals) ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="line-ed__row">
        <span className="field__hint">裏の攻撃をしなかった回は空のまま（表に「X」と出ます）。</span>
        {cols < 10 && (
          <button type="button" className="btn btn--outline" onClick={() => setCols(cols + 1)}>
            ＋延長
          </button>
        )}
      </div>
    </div>
  );
}

const emptyResult = (): NonNullable<GameInput["result"]> => ({
  scoreA: null,
  scoreB: null,
  onBaseA: null,
  onBaseB: null,
  called: false,
  innings: null,
  lineA: [],
  lineB: [],
  firstBat: "a",
});

/** 「第1試合の負け」→「B中とC中の敗者」のように短く（その試合が他チーム同士のとき） */
function sideName(t: string, games: Game[], thisNo: number): string {
  return teamName(t, games, thisNo);
}

function teamName(t: string, games: Game[], thisNo: number): string {
  const r = parseRef(t);
  if (!r) return t.trim();
  const p = games.find((g) => g.no === r.game && g.no < thisNo);
  const a = p ? (p.stormPlays === false ? p.opponent : OUR) : "";
  const b = p ? (p.stormPlays === false ? p.opponent2 : p.opponent) : "";
  return a && b ? `${a}と${b}の${r.win ? "勝者" : "敗者"}` : `第${r.game}試合の${r.win ? "勝者" : "敗者"}`;
}

const GAME_PRESETS = ["08:30", "09:00", "09:30", "10:00", "11:00", "13:00"];

export default function GamePanel({
  unitId,
  games,
  tournamentName,
  activityType,
  title,
  date,
  canEdit,
  demo,
  onChange,
  notify,
}: {
  unitId?: string;
  games: Game[];
  tournamentName?: string;
  activityType?: string;
  /** 結果カードに出す大会名 */
  title?: string;
  /** 活動日 "2026-10-24" */
  date?: string;
  canEdit: boolean;
  demo: boolean;
  onChange: (next: Game[]) => void;
  notify: (kind: "ok" | "ng", text: string) => void;
}) {
  const [editing, setEditing] = useState<{ id: string | null; no: number; form: GameInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // JJBF大会・STORM杯だけ、結果の欄とリーグ戦の状況を出す
  const rule = leagueRuleOf({ tournamentName, type: activityType });
  // 大会・公式戦だけ、審判の組み合わせを選べる（練習試合は今までどおり文字で入力）
  const isTourney = activityType === "公式戦" || activityType === "大会";
  const sorted = [...games].sort((a, b) => a.no - b.no);
  const last = sorted.at(-1);
  // 2試合以上あれば、出塁数も入れられるようにする（勝ち点・失点・得失点差が並んだとき用）
  const [withOnBase, setWithOnBase] = useState(false);
  const showOnBase =
    withOnBase || games.some((g) => g.onBaseA != null || g.onBaseB != null);

  function openNew() {
    // 次の試合の開始時間は「前の試合の2時間後」を初期値にする
    const start = last?.start ? shiftTime(last.start, 120) : "";
    setError(null);
    setEditing({
      id: null,
      no: (last?.no ?? 0) + 1,
      form: { start, opponent: "", stormPlays: true, opponent2: "", umpireTeam: "", note: "", result: emptyResult() },
    });
  }

  function openEdit(g: Game) {
    if (!canEdit) return;
    setError(null);
    setEditing({
      id: g.id ?? null,
      no: g.no,
      form: {
        start: g.start ?? "",
        opponent: g.opponent ?? "",
        stormPlays: g.stormPlays !== false,
        opponent2: g.opponent2 ?? "",
        umpireTeam: g.umpireTeam ?? "",
        note: g.note ?? "",
        result: {
          scoreA: g.scoreA ?? null,
          scoreB: g.scoreB ?? null,
          onBaseA: g.onBaseA ?? null,
          onBaseB: g.onBaseB ?? null,
          called: g.called === true,
          innings: g.innings ?? null,
          lineA: g.lineA ?? [],
          lineB: g.lineB ?? [],
          firstBat: g.firstBat ?? "a",
        },
      },
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);

    let saved: Game;
    if (demo || !unitId) {
      saved = {
        id: editing.id ?? `demo-game-${Date.now()}`,
        no: editing.no,
        start: editing.form.start || undefined,
        opponent: editing.form.opponent.trim() || undefined,
        stormPlays: editing.form.stormPlays,
        opponent2: editing.form.stormPlays ? undefined : editing.form.opponent2.trim() || undefined,
        umpireTeam: editing.form.umpireTeam.trim() || undefined,
        ...(rule && editing.form.result
          ? {
              scoreA: editing.form.result.scoreA ?? undefined,
              scoreB: editing.form.result.scoreB ?? undefined,
              onBaseA: editing.form.result.onBaseA ?? undefined,
              onBaseB: editing.form.result.onBaseB ?? undefined,
              called: editing.form.result.called || undefined,
              innings: editing.form.result.innings ?? undefined,
              lineA: editing.form.result.lineA.some((v) => v != null) ? editing.form.result.lineA : undefined,
              lineB: editing.form.result.lineB.some((v) => v != null) ? editing.form.result.lineB : undefined,
              firstBat: editing.form.result.firstBat === "b" ? "b" : undefined,
            }
          : {}),
        note: editing.form.note.trim() || undefined,
      };
    } else {
      const result = await saveGame(unitId, editing.id, editing.no, rule ? editing.form : { ...editing.form, result: undefined });
      if (!result.ok) {
        setBusy(false);
        setError(result.message);
        return;
      }
      // 人数制は別の画面で保存しているので、元の値を残す
      saved = { ...result.game, system: games.find((g) => g.id === result.game.id)?.system };
    }
    setBusy(false);

    const exists = games.some((g) => g.id && g.id === saved.id);
    onChange(exists ? games.map((g) => (g.id === saved.id ? saved : g)) : [...games, saved]);
    notify("ok", demo ? "保存しました（お試しモード）" : "保存しました");
    setEditing(null);
  }

  async function remove() {
    if (!editing?.id) return;
    const later = sorted.filter((g) => g.no > editing.no).length;
    const msg = later
      ? `第${editing.no}試合を削除します。\n後ろの試合の番号は1つずつ繰り上がります（第${editing.no + 1}試合 → 第${editing.no}試合）。\nよろしいですか？`
      : `第${editing.no}試合を削除しますか？`;
    if (!window.confirm(msg)) return;

    if (!demo) {
      setBusy(true);
      const result = await deleteGame(editing.id);
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
    }
    const removedNo = editing.no;
    onChange(
      games
        .filter((g) => g.id !== editing.id)
        .map((g) => (g.no > removedNo ? { ...g, no: g.no - 1 } : g)),
    );
    notify("ok", demo ? "削除しました（お試しモード）" : "削除しました");
    setEditing(null);
  }

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">試合情報</h2>
        <span className="count-badge">{games.length}試合</span>
      </div>

      {sorted.length === 0 ? (
        <p className="muted game-empty">まだ試合が登録されていません。練習のみの日は、このままで大丈夫です。</p>
      ) : (
        <ul className="game-list">
          {sorted.map((g) => (
            <li key={g.id ?? g.no}>
              <button type="button" className="game" onClick={() => openEdit(g)} disabled={!canEdit}>
                <span className="game__no">第{g.no}試合</span>
                <span className={`game__time${g.start ? "" : " is-empty"}`}>{g.start ? formatTime(g.start) : "時間未定"}</span>
                <span className="game__info">
                  {g.stormPlays === false ? (
                    <>
                      <span className="game__opp">{matchupText(g)}</span>
                      <span className="game__tag">STORMは審判のみ</span>
                    </>
                  ) : g.opponent ? (
                    <span className="game__opp">vs {g.opponent}</span>
                  ) : (
                    <span className="muted">対戦相手 未定</span>
                  )}
                  {isTourney && umpireName(activityType, sorted, sorted.indexOf(g)) && (
                    <span className="game__ump">審判　{umpireName(activityType, sorted, sorted.indexOf(g))}</span>
                  )}
                  {g.note && <span className="game__note">{g.note}</span>}
                </span>
                {canEdit && (
                  <span className="issue__chev" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {canEdit && games.length < MAX_GAMES && (
        <button type="button" className="btn btn--block btn--outline" onClick={openNew}>
          ＋ 第{(last?.no ?? 0) + 1}試合を追加
        </button>
      )}

      {rule && <LeaguePanel games={games} tournamentName={tournamentName} type={activityType} />}
      {rule && canEdit && date && (
        <ResultSend games={games} tournamentName={tournamentName} type={activityType} title={title || activityType || "大会"} date={date} />
      )}

      {editing && (
        <div className="sheet-backdrop" role="presentation" onClick={() => !busy && setEditing(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2 className="sheet__title">
                第{editing.no}試合{editing.id ? "を編集" : "を追加"}
              </h2>
              <button type="button" className="sheet__close" onClick={() => setEditing(null)} disabled={busy} aria-label="閉じる">
                ×
              </button>
            </div>

            <div className="field">
              <span className="field__label">試合開始時間</span>
              <TimeField
                value={editing.form.start}
                onChange={(v) => setEditing((e) => (e ? { ...e, form: { ...e.form, start: v } } : e))}
                label="試合開始時間"
                presets={GAME_PRESETS}
                baseForAdjust={last?.start ?? "09:00"}
              />
            </div>

            <div className="field">
              <span className="field__label">この試合は</span>
              <div className="seg seg--2" role="radiogroup" aria-label="STORMが試合に出るか">
                <button
                  type="button"
                  role="radio"
                  aria-checked={editing.form.stormPlays}
                  className={`seg__btn${editing.form.stormPlays ? " is-active" : ""}`}
                  onClick={() => setEditing((s) => (s ? { ...s, form: { ...s.form, stormPlays: true } } : s))}
                >
                  STORMが出る
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!editing.form.stormPlays}
                  className={`seg__btn${!editing.form.stormPlays ? " is-active" : ""}`}
                  onClick={() => setEditing((s) => (s ? { ...s, form: { ...s.form, stormPlays: false } } : s))}
                >
                  審判だけ（他チーム同士）
                </button>
              </div>
            </div>

            <label className="field">
              <span className="field__label">{editing.form.stormPlays ? "対戦相手（任意）" : "チームA"}</span>
              <input
                className="input"
                value={editing.form.opponent}
                onChange={(e) => setEditing((s) => (s ? { ...s, form: { ...s.form, opponent: e.target.value } } : s))}
                placeholder={editing.form.stormPlays ? "例：川越ベアーズ（第1試合の負け、でもOK）" : "例：山王・入間野クラブ"}
              />
            </label>

            {!editing.form.stormPlays && (
              <label className="field">
                <span className="field__label">チームB</span>
                <input
                  className="input"
                  value={editing.form.opponent2}
                  onChange={(e) => setEditing((s) => (s ? { ...s, form: { ...s.form, opponent2: e.target.value } } : s))}
                  placeholder="例：KCミドル"
                />
              </label>
            )}

            {isTourney ? (
              (() => {
                // いま編集中の内容を入れた、この日の試合の並び
                const draft: Game = {
                  id: editing.id ?? undefined,
                  no: editing.no,
                  stormPlays: editing.form.stormPlays,
                  opponent: editing.form.opponent.trim() || undefined,
                  opponent2: editing.form.opponent2.trim() || undefined,
                };
                const rest = sorted.filter((g) => g.no !== editing.no);
                const list = [...rest, draft].sort((a, b) => a.no - b.no);
                const idx = list.findIndex((g) => g.no === editing.no);
                return (
                  <div className="field">
                    <UmpirePicker
                      key={`ump-${editing.no}`}
                      i={idx}
                      value={editing.form.umpireTeam}
                      auto={autoUmpire(activityType, list, idx)}
                      teams={dayTeamNames(list)}
                      games={list}
                      onChange={(v) => setEditing((s) => (s ? { ...s, form: { ...s.form, umpireTeam: v } } : s))}
                    />
                  </div>
                );
              })()
            ) : (
  <label className="field">
                <span className="field__label">審判を出す他チーム（任意）</span>
                <input
                  className="input"
                  value={editing.form.umpireTeam}
                  onChange={(e) => setEditing((s) => (s ? { ...s, form: { ...s.form, umpireTeam: e.target.value } } : s))}
                  placeholder="例：第1試合の勝者"
                />
                <span className="field__hint">審判の画面で「他チームが担当」を選んだ枠に、このチーム名が出ます。</span>
              </label>
            )}

            {rule && editing.form.result && (
              <ScoreRow
                left={editing.form.stormPlays ? OUR : teamName(editing.form.opponent, games, editing.no) || "チームA"}
                right={
                  teamName(editing.form.stormPlays ? editing.form.opponent : editing.form.opponent2, games, editing.no) ||
                  (editing.form.stormPlays ? "相手" : "チームB")
                }
                sl={editing.form.result.scoreA}
                sr={editing.form.result.scoreB}
                ol={editing.form.result.onBaseA}
                or={editing.form.result.onBaseB}
                showOnBase={showOnBase}
                storm={rule === "storm"}
                called={editing.form.result.called}
                inn={editing.form.result.innings}
                onChange={(p) =>
                  setEditing((s) => (s && s.form.result ? { ...s, form: { ...s.form, result: { ...s.form.result, ...p } } } : s))
                }
              />
            )}
            {rule && editing.form.result && (
              <LineEditor
                key={`line-${editing.no}`}
                left={sideName(editing.form.stormPlays ? OUR : editing.form.opponent, games, editing.no) || "チームA"}
                right={
                  sideName(editing.form.stormPlays ? editing.form.opponent : editing.form.opponent2, games, editing.no) ||
                  (editing.form.stormPlays ? "相手" : "チームB")
                }
                g={editing.form.result}
                onChange={(p) =>
                  setEditing((s) => (s && s.form.result ? { ...s, form: { ...s.form, result: { ...s.form.result, ...p } } } : s))
                }
              />
            )}
            {rule && editing.form.result && games.length >= 1 && (
              <label className="score-row__opt">
                <input type="checkbox" checked={showOnBase} onChange={(e) => setWithOnBase(e.target.checked)} /> 出塁数も入れる（勝ち点・失点・得失点差が並んだとき用）
              </label>
            )}

            <label className="field">
              <span className="field__label">備考</span>
              <textarea
                className="input input--area"
                rows={2}
                value={editing.form.note}
                onChange={(e) => setEditing((s) => (s ? { ...s, form: { ...s.form, note: e.target.value } } : s))}
                placeholder="例：時間は相手チームに確認中"
              />
            </label>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            {editing.id && (
              <button type="button" className="btn btn--danger btn--block" onClick={remove} disabled={busy}>
                この試合を削除
              </button>
            )}

            <div className="sheet__actions">
              <button type="button" className="btn" onClick={() => setEditing(null)} disabled={busy}>
                やめる
              </button>
              <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? "保存しています…" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
