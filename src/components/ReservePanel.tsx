"use client";

// 大会の予備日を入れる：予備日の日付・表示名・予備日の会場（ちがう場合だけ）
import { useEffect, useState } from "react";
import TournamentNameChips from "@/components/TournamentNameChips";
import type { TournamentOption } from "@/lib/data";
import { mdw } from "@/lib/reserve";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** date より後で、いちばん近い曜日（0=日〜6=土） */
function nextWeekday(date: string, wd: number): string {
  const cur = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, ((wd - cur + 6) % 7) + 1);
}

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
  level = 1,
  baseDate,
  umpireNeeded = 0,
  embedded = false,
  plan,
  planBase = "大会",
}: {
  /** 大会が実施された場合の、予備日の予定 */
  plan?: string;
  /** 「大会2日目」などの名前のもと（例：JJBF大会） */
  planBase?: string;
  /** この予備日のもとになる日（当日 または ひとつ前の予備日）。日付の選びやすいボタンに使う */
  baseDate?: string;
  /** 必要な審判の人数（0 = 不要・未設定） */
  umpireNeeded?: number;
  /** 1つのカードの中に並べて表示するか */
  embedded?: boolean;
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
  onSave: (date: string | null, name: string | null, venue: string | null, umpires: string[], plan: string | null) => Promise<boolean>;
  /** 1 = 予備日 / 2 = 予備日の予備日 */
  level?: 1 | 2;
}) {
  const [d, setD] = useState(date ?? "");
  const [n, setN] = useState(name ?? "");
  const [v, setV] = useState(venue ?? "");
  const [u, setU] = useState<string[]>(umpires);
  const [p, setP] = useState(plan ?? "");
  const [busy, setBusy] = useState(false);
  const label = level === 2 ? "予備日の予備日" : "予備日";
  const Wrap = embedded ? "div" : "section";
  const wrapClass = embedded ? `rsv-step rsv-step--${level}` : "panel";
  const title = embedded ? (level === 2 ? "② 予備日の予備日（予備日も延期になったとき）" : "① 予備日（当日が延期になったとき）") : label;
  const quick = baseDate
    ? [
        { text: "翌日", date: addDays(baseDate, 1) },
        { text: "次の週の同じ曜日", date: addDays(baseDate, 7) },
        { text: "次の土曜", date: nextWeekday(baseDate, 6) },
        { text: "次の日曜", date: nextWeekday(baseDate, 0) },
      ].filter((q, i, a) => a.findIndex((x) => x.date === q.date) === i)
    : [];
  useEffect(() => {
    setD(date ?? "");
    setN(name ?? "");
    setV(venue ?? "");
    setU(umpires);
    setP(plan ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, name, venue, plan, umpires.join("、")]);

  if (!isAdmin && !date) return null;

  const changed = p !== (plan ?? "") || d !== (date ?? "") || n !== (name ?? "") || v !== (venue ?? "") || u.join("、") !== umpires.join("、");
  async function save(nextDate: string | null) {
    setBusy(true);
    await onSave(nextDate, n || null, v || null, u, p || null);
    setBusy(false);
  }

  if (!isAdmin) {
    return (
      <Wrap className={wrapClass}>
        <h2 className="panel__title">{title}</h2>
        <p>
          {mdw(date!)}
          {venue ? `　${venue}` : ""}
          {umpires.length ? `　審判：${umpires.join("・")}` : ""}
        </p>
      </Wrap>
    );
  }

  return (
    <Wrap className={wrapClass}>
      <div className="panel__row">
        <h2 className="panel__title">{title}</h2>
        {date && (
          <button
            type="button"
            className="tour-off"
            disabled={busy}
            onClick={() => {
              setD("");
              setN("");
              setV("");
              setP("");
              void save(null);
            }}
          >
            {label}をなくす
          </button>
        )}
      </div>
      <div className="field">
        <span className="field__label">{label}の日にち{d ? `：${mdw(d)}` : "（任意）"}</span>
        {quick.length > 0 && (
          <div className="pr-chips">
            {quick.map((q) => (
              <button key={q.text} type="button" className={`pr-chip${d === q.date ? " is-on" : ""}`} disabled={busy} onClick={() => setD(q.date)}>
                {q.text}（{mdw(q.date)}）
              </button>
            ))}
          </div>
        )}
        <input type="date" className="input" value={d} disabled={busy} onChange={(e) => setD(e.target.value)} />
      </div>
      {d && (
        <>
          {level === 1 && (<>
          <label className="field">
            <span className="field__label">予備日での呼び名（任意・大会名を選んで「1日目」などを足せます）</span>
            <input className="input" value={n} disabled={busy} onChange={(e) => setN(e.target.value)} placeholder={`例：${defaultName || "JJBF 1日目"}`} />
          </label>
          <TournamentNameChips names={tournaments} value={n} isAdmin={isAdmin} demo={demo} disabled={busy} onPick={setN} />
          </>)}
          <label className="field">
            <span className="field__label">{label}の会場</span>
            <input className="input" value={v} disabled={busy} onChange={(e) => setV(e.target.value)} placeholder="空なら、この日と同じ会場" />
          </label>
          <div className="pr-chips">
            <button type="button" className={`pr-chip${v === "" ? " is-on" : ""}`} disabled={busy} onClick={() => setV("")}>
              この日と同じ会場
            </button>
            {venueChoices.map((c) => (
              <button key={c} type="button" className={`pr-chip${v === c ? " is-on" : ""}`} disabled={busy} onClick={() => setV(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="field">
            <span className="field__label">
              大会が予定どおり実施されたとき、{mdw(d)}の予定
              {p ? `：${p}` : "（未選択）"}
            </span>
            <div className="pr-chips">
              {[
                "休養日",
                "練習",
                `${planBase} 2日目`,
                `${planBase} 3日目`,
              ].map((c) => (
                <button key={c} type="button" className={`pr-chip${p === c ? " is-on" : ""}`} disabled={busy} onClick={() => setP(p === c ? "" : c)}>
                  {c}
                </button>
              ))}
            </div>
            <span className="field__label">他の大会にする場合（名前を選ぶか、入力）</span>
            <TournamentNameChips names={tournaments} value={p} isAdmin={isAdmin} demo={demo} disabled={busy} onPick={setP} />
            <input className="input" value={p} disabled={busy} onChange={(e) => setP(e.target.value)} placeholder="例：○○大会 1日目（空なら、この日の登録内容どおり）" />
          </div>
          <div className="field">
            <span className="field__label">
              {label}の審判（出せる人を選ぶ）
              {umpireNeeded > 0 && (
                <b className={u.length >= umpireNeeded ? "rsv-count rsv-count--ok" : "rsv-count"}>
                  　{u.length}/{umpireNeeded}名{u.length >= umpireNeeded ? "　そろいました" : `　あと${umpireNeeded - u.length}名`}
                </b>
              )}
            </span>
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
        </>
      )}
      <button type="button" className="btn btn--block btn--primary" disabled={busy || !changed || !d} onClick={() => save(d)}>
        {busy ? "保存中…" : changed ? `${label}を保存する` : date ? "保存済み" : `${label}を保存する`}
      </button>
      {level === 1 && <p className="field__hint">保存すると、その日付に「☂ ○/○ 大会 の予備日」と自動で表示され、印刷する予定表にも載ります。審判は、決まったらここで足せます（LINEのお知らせも作れます）。</p>}
    </Wrap>
  );
}

