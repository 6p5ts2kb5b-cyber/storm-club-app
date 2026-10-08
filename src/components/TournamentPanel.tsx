"use client";

// 大会しだいで変わる予定：「大会が実施されたら休み／実施されなければ練習」
import { useEffect, useState } from "react";
import { type TournamentState } from "@/lib/status";

export const DEFAULT_TOURNAMENT = "STORM杯・JJBF大会";

const CHOICES: { state: TournamentState; title: string; sub: string }[] = [
  { state: "pending", title: "確認中", sub: "まだ分からない" },
  { state: "held", title: "実施される", sub: "→ 休み" },
  { state: "not_held", title: "実施されない", sub: "→ 練習" },
];

export default function TournamentPanel({
  name,
  state,
  reserveOf,
  isAdmin,
  onSave,
}: {
  name?: string;
  state?: TournamentState;
  reserveOf?: string;
  isAdmin: boolean;
  onSave: (name: string | null, state: TournamentState, reserveOf: string | null) => Promise<boolean>;
}) {
  const [text, setText] = useState(name ?? DEFAULT_TOURNAMENT);
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(name ?? DEFAULT_TOURNAMENT), [name]);

  const on = Boolean(name);
  // 管理者以外は、設定されているときだけ見る
  if (!on && !isAdmin) return null;

  async function save(n: string | null, s: TournamentState, r: string | null = reserveOf ?? null) {
    setBusy(true);
    await onSave(n, s, r);
    setBusy(false);
  }

  if (!on) {
    return (
      <section className="panel">
        <div className="panel__row">
          <h2 className="panel__title">大会しだいの予定</h2>
        </div>
        <p className="muted tour-note">
          「大会が実施されたら休み、実施されなければ練習」のように、大会の実施で予定が変わる日は、ここで設定します。
        </p>
        <button type="button" className="btn btn--block btn--outline" disabled={busy} onClick={() => save(text.trim() || DEFAULT_TOURNAMENT, "pending", null)}>
          ＋ 大会しだいの予定にする
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">大会しだいの予定</h2>
        {isAdmin && (
          <button type="button" className="tour-off" disabled={busy} onClick={() => save(null, "pending", null)}>
            設定をやめる
          </button>
        )}
      </div>

      <label className="field">
        <span className="field__label">大会の名前</span>
        <input
          className="input"
          value={text}
          disabled={!isAdmin || busy}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text.trim() !== name && save(text.trim(), state ?? "pending")}
          placeholder={DEFAULT_TOURNAMENT}
        />
      </label>

      <label className="field">
        <span className="field__label">予備日の設定（任意）：この日は、何日の大会の予備日？</span>
        <input
          type="date"
          className="input"
          value={reserveOf ?? ""}
          disabled={!isAdmin || busy}
          onChange={(e) => save(name ?? text, state ?? "pending", e.target.value || null)}
        />
        <span className="field__hint">入れると、「10/11 {name} の予備日」と表示され、印刷する予定表にも載ります。</span>
      </label>

      <div className="field">
        <span className="field__label">{name}は</span>
        <div className="tour-choices" role="radiogroup" aria-label="大会が実施されるか">
          {CHOICES.map((c) => {
            const active = (state ?? "pending") === c.state;
            return (
              <button
                key={c.state}
                type="button"
                role="radio"
                aria-checked={active}
                className={`tour-choice tour-choice--${c.state}${active ? " is-active" : ""}`}
                disabled={!isAdmin || busy}
                onClick={() => !active && save(name ?? text, c.state)}
              >
                <span className="tour-choice__title">{c.title}</span>
                <span className="tour-choice__sub">{c.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="muted tour-note">
        {state === "held"
          ? "大会が実施されたので、この日は「休養日」です。"
          : state === "not_held"
            ? "大会は実施されないので、通常どおり練習の準備を進めます。"
            : "実施が決まるまでは「確認中」と表示します。実施されないときの練習の会場・時間は、下で先に入れておけます。"}
      </p>
    </section>
  );
}
