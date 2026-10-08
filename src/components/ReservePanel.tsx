"use client";

// 大会の予備日を入れる：予備日の日付・表示名・予備日の会場（ちがう場合だけ）
import { useEffect, useState } from "react";
import TournamentNameChips from "@/components/TournamentNameChips";
import type { TournamentOption } from "@/lib/data";
import { mdw } from "@/lib/reserve";

export default function ReservePanel({
  date,
  name,
  venue,
  umpires,
  umpireChoices,
  tournaments = [],
  demo = false,
  defaultName,
  venueChoices,
  isAdmin,
  onSave,
}: {
  date?: string;
  name?: string;
  venue?: string;
  /** 予備日に審判を出す人（名前） */
  umpires: string[];
  /** 選べる審判（名前） */
  umpireChoices: string[];
  tournaments?: TournamentOption[];
  demo?: boolean;
  /** 表示名の見本（活動の種類） */
  defaultName: string;
  /** 会場の候補（候補グラウンドの名前など） */
  venueChoices: string[];
  isAdmin: boolean;
  onSave: (date: string | null, name: string | null, venue: string | null, umpires: string[]) => Promise<boolean>;
}) {
  const [d, setD] = useState(date ?? "");
  const [n, setN] = useState(name ?? "");
  const [v, setV] = useState(venue ?? "");
  const [u, setU] = useState<string[]>(umpires);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setD(date ?? "");
    setN(name ?? "");
    setV(venue ?? "");
    setU(umpires);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, name, venue, umpires.join("、")]);

  if (!isAdmin && !date) return null;

  const changed = d !== (date ?? "") || n !== (name ?? "") || v !== (venue ?? "") || u.join("、") !== umpires.join("、");
  async function save(nextDate: string | null) {
    setBusy(true);
    await onSave(nextDate, n || null, v || null, u);
    setBusy(false);
  }

  if (!isAdmin) {
    return (
      <section className="panel">
        <h2 className="panel__title">予備日</h2>
        <p>
          {mdw(date!)}
          {venue ? `　${venue}` : ""}
          {umpires.length ? `　審判：${umpires.join("・")}` : ""}
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">予備日</h2>
        {date && (
          <button
            type="button"
            className="tour-off"
            disabled={busy}
            onClick={() => {
              setD("");
              setN("");
              setV("");
              void save(null);
            }}
          >
            予備日をなくす
          </button>
        )}
      </div>
      <label className="field">
        <span className="field__label">予備日（任意）</span>
        <input type="date" className="input" value={d} disabled={busy} onChange={(e) => setD(e.target.value)} />
      </label>
      {d && (
        <>
          <label className="field">
            <span className="field__label">予備日での呼び名（任意・大会名を選んで「1日目」などを足せます）</span>
            <input className="input" value={n} disabled={busy} onChange={(e) => setN(e.target.value)} placeholder={`例：${defaultName || "JJBF 1日目"}`} />
          </label>
          <TournamentNameChips names={tournaments} value={n} isAdmin={isAdmin} demo={demo} disabled={busy} onPick={setN} />
          <label className="field">
            <span className="field__label">予備日の会場（ちがう場合だけ）</span>
            <input className="input" value={v} disabled={busy} onChange={(e) => setV(e.target.value)} placeholder="空なら、この日と同じ会場" />
          </label>
          <div className="field">
            <span className="field__label">予備日の審判（出せる人を選ぶ）</span>
            <div className="pr-chips">
              {[...new Set([...umpireChoices, ...u])].map((nm) => {
                const on = u.includes(nm);
                return (
                  <button
                    key={nm}
                    type="button"
                    aria-pressed={on}
                    className={`pr-chip${on ? " is-on" : ""}`}
                    disabled={busy}
                    onClick={() => setU(on ? u.filter((x) => x !== nm) : [...u, nm])}
                  >
                    {nm}
                  </button>
                );
              })}
            </div>
          </div>
          {venueChoices.length > 0 && (
            <div className="pr-chips">
              {venueChoices.map((c) => (
                <button key={c} type="button" className={`pr-chip${v === c ? " is-on" : ""}`} disabled={busy} onClick={() => setV(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <button type="button" className="btn btn--block btn--primary" disabled={busy || !changed || !d} onClick={() => save(d)}>
        {busy ? "保存中…" : "予備日を保存する"}
      </button>
      <p className="field__hint">保存すると、その日付に「☂ ○/○ 大会 の予備日」と自動で表示され、印刷する予定表にも載ります。</p>
    </section>
  );
}

