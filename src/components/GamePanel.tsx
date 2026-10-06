"use client";

// 試合情報：第1〜第N試合の開始時間・対戦相手・備考
import { useState } from "react";
import TimeField, { shiftTime } from "@/components/TimeField";
import { deleteGame, type GameInput, saveGame } from "@/lib/activity-actions";
import { formatTime } from "@/lib/divisions";
import type { Game } from "@/lib/status";

const MAX_GAMES = 10;
const GAME_PRESETS = ["08:30", "09:00", "09:30", "10:00", "11:00", "13:00"];

export default function GamePanel({
  unitId,
  games,
  canEdit,
  demo,
  onChange,
  notify,
}: {
  unitId?: string;
  games: Game[];
  canEdit: boolean;
  demo: boolean;
  onChange: (next: Game[]) => void;
  notify: (kind: "ok" | "ng", text: string) => void;
}) {
  const [editing, setEditing] = useState<{ id: string | null; no: number; form: GameInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...games].sort((a, b) => a.no - b.no);
  const last = sorted.at(-1);

  function openNew() {
    // 次の試合の開始時間は「前の試合の2時間後」を初期値にする
    const start = last?.start ? shiftTime(last.start, 120) : "";
    setError(null);
    setEditing({ id: null, no: (last?.no ?? 0) + 1, form: { start, opponent: "", note: "" } });
  }

  function openEdit(g: Game) {
    if (!canEdit) return;
    setError(null);
    setEditing({ id: g.id ?? null, no: g.no, form: { start: g.start ?? "", opponent: g.opponent ?? "", note: g.note ?? "" } });
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
        note: editing.form.note.trim() || undefined,
      };
    } else {
      const result = await saveGame(unitId, editing.id, editing.no, editing.form);
      if (!result.ok) {
        setBusy(false);
        setError(result.message);
        return;
      }
      saved = result.game;
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
                  {g.opponent ? <span className="game__opp">vs {g.opponent}</span> : <span className="muted">対戦相手 未定</span>}
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

            <label className="field">
              <span className="field__label">対戦相手（任意）</span>
              <input
                className="input"
                value={editing.form.opponent}
                onChange={(e) => setEditing((s) => (s ? { ...s, form: { ...s.form, opponent: e.target.value } } : s))}
                placeholder="例：川越ベアーズ"
              />
            </label>

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
