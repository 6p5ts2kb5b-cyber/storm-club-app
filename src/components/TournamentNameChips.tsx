"use client";

// 登録してある大会名を、ボタンで選ぶ／新しく登録する／消す
import { useEffect, useState } from "react";
import { addTournamentName, removeTournamentName } from "@/lib/activity-actions";
import type { TournamentOption } from "@/lib/data";

export default function TournamentNameChips({
  names,
  value,
  onPick,
  isAdmin,
  demo,
  disabled,
}: {
  names: TournamentOption[];
  /** いま入力されている名前 */
  value: string;
  onPick: (name: string) => void;
  isAdmin: boolean;
  demo: boolean;
  disabled?: boolean;
}) {
  const [list, setList] = useState(names);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setList(names), [names]);

  const v = value.trim();
  const canRegister = isAdmin && v !== "" && !list.some((t) => t.name === v);

  async function register() {
    setBusy(true);
    setError(null);
    if (demo) {
      setList([...list, { id: `demo-${v}`, name: v }]);
    } else {
      const r = await addTournamentName(v);
      if (!r.ok) setError(r.message);
      else setList([...list, { id: r.id ?? `new-${v}`, name: v }]);
    }
    setBusy(false);
  }

  async function remove(t: TournamentOption) {
    if (!window.confirm(`登録から「${t.name}」を消しますか？（すでに使っている予定の名前は、そのまま残ります）`)) return;
    setBusy(true);
    setError(null);
    if (!demo) {
      const r = await removeTournamentName(t.id);
      if (!r.ok) {
        setError(r.message);
        setBusy(false);
        return;
      }
    }
    setList(list.filter((x) => x.id !== t.id));
    setBusy(false);
  }

  return (
    <div className="tname">
      {list.length > 0 && (
        <div className="pr-chips">
          {list.map((t) => (
            <span key={t.id} className="tname__item">
              <button
                type="button"
                className={`pr-chip${v === t.name ? " is-on" : ""}`}
                disabled={disabled || busy}
                onClick={() => onPick(t.name)}
              >
                {t.name}
              </button>
              {isAdmin && (
                <button type="button" className="tname__x" aria-label={`${t.name}を登録から消す`} disabled={disabled || busy} onClick={() => remove(t)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {canRegister && (
        <button type="button" className="btn btn--outline" disabled={disabled || busy} onClick={register}>
          ＋「{v}」を大会名に登録
        </button>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
