"use client";

// 大会の試合の審判：この日のチーム・「第1試合の勝者／敗者」・別の試合の2チームを選ぶ（いくつでも）。
// 2つ以上選んだら「各チームから○名ずつ」、ほかに「連盟から○名」も足せる。何も選ばなければ自動（3チーム・3試合の日だけ）。
import { useState } from "react";
import { parseRef } from "@/lib/league";
import type { Game } from "@/lib/status";
import { encodeUmp, gameTeams, parseUmp, umpText, type UmpSet } from "@/lib/umpire-team";

export default function UmpirePicker({
  i,
  value,
  auto,
  teams,
  games,
  onChange,
}: {
  /** この試合の順番（0から） */
  i: number;
  /** いまの値（試合の umpire_team） */
  value: string;
  /** 自動の値（なければ空） */
  auto: string;
  /** この日のチーム */
  teams: string[];
  /** この日の試合（この試合も含む。順番どおり） */
  games: Game[];
  onChange: (v: string) => void;
}) {
  const refs = Array.from({ length: i }, (_, k) => [`第${k + 1}試合の勝者`, `第${k + 1}試合の敗者`]).flat();
  const options = [...teams, ...refs];
  const set = parseUmp(value);
  const usingAuto = !value.trim() && !!auto;
  const shown = usingAuto ? parseUmp(auto) : set;
  const custom = set.items.filter((t) => !options.includes(t));
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const save = (x: UmpSet) => {
    const v = encodeUmp(x);
    onChange(v === auto ? "" : v); // 自動と同じなら空（自動のまま）
  };
  const toggle = (o: string) => {
    // 自動のときは、選び直し（自動に足さない）
    const base = usingAuto ? { items: [], n: 0, fed: shown.fed } : set;
    const items = base.items.includes(o) ? base.items.filter((t) => t !== o) : [...base.items, o];
    save({ ...base, items, n: items.length >= 2 ? base.n || 1 : base.n });
  };
  // ほかの試合の2チームをまとめて選ぶ
  const others = games.map((_, j) => j).filter((j) => j !== i);
  const text = umpText(shown);

  return (
    <div className="ump-pick">
      <div className="ump-pick__now">
        <b>審判</b>
        <span>
          {text || "未定"}
          {usingAuto && <small>（自動）</small>}
        </span>
      </div>
      <p className="field__hint">出すチームを押します（いくつでも選べます）。</p>
      <div className="ump-pick__chips">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`pick${parseRef(o) ? " pick--ref" : ""}${shown.items.includes(o) ? " is-active" : ""}`}
            aria-pressed={shown.items.includes(o)}
            onClick={() => {
              setTyping(false);
              toggle(o);
            }}
          >
            {o}
          </button>
        ))}
        {custom.map((o) => (
          <button key={`c-${o}`} type="button" className="pick is-active" aria-pressed onClick={() => toggle(o)}>
            ✎ {o}
          </button>
        ))}
        {others.map((j) => {
          const ts = gameTeams(games[j]);
          if (ts.length < 2) return null;
          const on = ts.every((t) => shown.items.includes(t)) && shown.items.length === ts.length;
          return (
            <button
              key={`x${j}`}
              type="button"
              className={`pick pick--cross${on ? " is-active" : ""}`}
              aria-pressed={on}
              onClick={() => {
                setTyping(false);
                save(on ? { items: [], n: 0, fed: shown.fed } : { items: ts, n: shown.n || 2, fed: shown.fed });
              }}
            >
              第{games[j].no}試合の2チームから
            </button>
          );
        })}
        <button type="button" className={`pick pick--other${typing ? " is-active" : ""}`} aria-pressed={typing} onClick={() => setTyping(!typing)}>
          ＋ 手で入力
        </button>
      </div>
      {typing && (
        <div className="ump-pick__type">
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="チーム名（例：大会役員）"
            autoComplete="off"
          />
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              const t = draft.trim();
              if (t) toggle(t);
              setDraft("");
              setTyping(false);
            }}
          >
            足す
          </button>
        </div>
      )}
      {shown.items.length >= 1 && (
        <div className="ump-pick__row">
          <span>{shown.items.length >= 2 ? "各チームから" : "人数"}</span>
          <div className="seg seg--4" role="group" aria-label="各チームから何名">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={`seg__btn${shown.n === n ? " is-active" : ""}`}
                aria-pressed={shown.n === n}
                onClick={() => save({ ...shown, n })}
              >
                {n === 0 ? "書かない" : `${n}名${shown.items.length >= 2 ? "ずつ" : ""}`}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ump-pick__row">
        <span>連盟から</span>
        <div className="seg seg--4" role="group" aria-label="連盟から何名">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={`seg__btn${shown.fed === n ? " is-active" : ""}`}
              aria-pressed={shown.fed === n}
              onClick={() => save({ ...shown, fed: n })}
            >
              {n === 0 ? "なし" : `${n}名`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
