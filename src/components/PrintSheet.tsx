"use client";

// スタッフ用の月間予定表：送り先・月・期間を選ぶと、A4の見本がすぐ変わる
import { useEffect, useMemo, useRef, useState } from "react";
import { DIVISION_LABEL, type Division } from "@/lib/divisions";
import { AUDIENCES, audienceName, buildRows, PERIOD_LABEL, type Period, type PrintGroup, sheetTitle } from "@/lib/print-plan";
import { elementToPdf, hasPdfSupport, shareOrDownload } from "@/lib/sharePdf";
import type { DaySummary } from "@/lib/status";

const PAPER_W = 794; // A4の幅（画面のピクセル）
const DIVISIONS: Division[] = ["storm", "top", "academy"];

function monthChoices(today: string): { year: number; month: number }[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1; // 0始まり
  return [-1, 0, 1, 2, 3].map((d) => {
    const t = new Date(Date.UTC(y, m + d, 1));
    return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
  });
}

function Group({ g }: { g: PrintGroup }) {
  return (
    <div className={`pl-g${g.rest ? " pl-g--quiet" : ""}`}>
      <p className="pl-title">
        {g.showDivision && <span className="pl-div">{DIVISION_LABEL[g.division]}</span>}
        <b className={g.rest ? "pl-rest" : undefined}>{g.title}</b>
        {g.rest && g.notes[0] && <span className="pl-why">{g.notes[0]}</span>}
      </p>
      {(g.lines.length > 0 || g.games.length > 0 || g.after.length > 0 || g.reserve || g.reserve2) && (
        <dl className="pl-dl">
          {g.lines.slice(0, 1).map((l) => (
            <Line key={l.k} k={l.k} v={l.v} strong={l.strong} />
          ))}
          {g.lines.slice(1).map((l) => (
            <Line key={l.k} k={l.k} v={l.v} strong={l.strong} />
          ))}
          {g.games.length > 0 && (
            <>
              <dt>試合</dt>
              <dd>
                <span className="pl-games">
                  {g.games.map((x, i) => (
                    <span key={i} className={x.others ? "pl-game pl-game--others" : "pl-game"}>
                      <b>{x.time}</b>
                      {x.text}
                    </span>
                  ))}
                </span>
              </dd>
            </>
          )}
          {g.after.map((l) => (
            <Line key={l.k} k={l.k} v={l.v} bold={l.bold} />
          ))}
          {g.reserve && <Line k="予備日" v={g.reserve} />}
          {g.reserve2 && <Line k="予備日2" v={g.reserve2} />}
        </dl>
      )}
      {!g.rest && g.notes.map((n, i) => (
        <p key={i} className="pl-note">
          ※{n}
        </p>
      ))}
    </div>
  );
}

function Line({ k, v, strong, bold }: { k: string; v: string; strong?: boolean; bold?: boolean }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={strong ? "pl-strong" : bold ? "pl-bold" : undefined}>{v}</dd>
    </>
  );
}

export default function PrintSheet({ days, today }: { days: DaySummary[]; today: string }) {
  const months = useMemo(() => monthChoices(today), [today]);
  const [audience, setAudience] = useState("all");
  const [divisions, setDivisions] = useState<Division[]>(AUDIENCES[0].divisions);
  const [ym, setYm] = useState(months[1]);
  const [period, setPeriod] = useState<Period>("month");
  const [message, setMessage] = useState("");

  const paper = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(0);

  const [pdfReady, setPdfReady] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [needRetry, setNeedRetry] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    hasPdfSupport().then(setPdfReady);
  }, []);

  const name = audienceName(divisions);
  const rows = useMemo(() => buildRows(days, divisions, ym.year, ym.month, period), [days, divisions, ym, period]);
  const title = sheetTitle(name, ym.year, ym.month, period);

  // 内容が変わったら、作り済みのPDFは捨てる
  useEffect(() => {
    setPdf(null);
    setNeedRetry(false);
    setInfo(null);
  }, [rows, title, message]);

  // 見本をスマホの幅に合わせて縮める
  useEffect(() => {
    const fit = () => {
      if (!box.current || !paper.current) return;
      const s = Math.min(1, box.current.clientWidth / PAPER_W);
      setScale(s);
      setHeight(paper.current.offsetHeight * s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    if (paper.current) ro.observe(paper.current);
    return () => ro.disconnect();
  }, [rows, message, title]);

  function pickAudience(key: string) {
    const a = AUDIENCES.find((x) => x.key === key);
    if (!a) return;
    setAudience(key);
    setDivisions(a.divisions);
  }

  function toggleDivision(d: Division) {
    setAudience("custom");
    setDivisions((cur) => (cur.includes(d) ? (cur.length > 1 ? cur.filter((x) => x !== d) : cur) : [...cur, d]));
  }

  async function send() {
    if (!paper.current) return;
    setBusy(true);
    setInfo(null);
    try {
      const file = pdf ?? (await elementToPdf(paper.current, `${title}.pdf`));
      setPdf(file);
      try {
        const r = await shareOrDownload(file, title);
        setNeedRetry(false);
        if (r === "downloaded") setInfo("PDFを保存しました。LINEやメールに添付して送ってください。");
      } catch {
        // iPhone：PDFを作るのに時間がかかると、共有画面が開かないことがある → もう一度押してもらう
        setNeedRetry(true);
      }
    } catch {
      setInfo("PDFを作れませんでした。「印刷」から、PDFとして保存してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pr-controls no-print">
        <section className="pr-block">
          <h2 className="field__label">送り先</h2>
          <div className="seg seg--3" role="radiogroup" aria-label="送り先">
            {AUDIENCES.map((a) => (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={audience === a.key}
                className={`seg__btn${audience === a.key ? " is-active" : ""}`}
                onClick={() => pickAudience(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>

        <section className="pr-block">
          <h2 className="field__label">載せる活動（押して足したり外したり）</h2>
          <div className="pr-chips">
            {DIVISIONS.map((d) => {
              const on = divisions.includes(d);
              return (
                <button key={d} type="button" aria-pressed={on} className={`pr-chip${on ? " is-on" : ""}`} onClick={() => toggleDivision(d)}>
                  <span aria-hidden="true">{on ? "✓" : ""}</span>
                  {d === "storm" ? "STORM（全体）" : DIVISION_LABEL[d]}
                </button>
              );
            })}
          </div>
        </section>

        <section className="pr-block">
          <h2 className="field__label">月</h2>
          <div className="pr-months">
            {months.map((m) => {
              const on = m.year === ym.year && m.month === ym.month;
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  aria-pressed={on}
                  className={`pr-month${on ? " is-on" : ""}`}
                  onClick={() => setYm(m)}
                >
                  <small>{m.year}</small>
                  <b>{m.month}月</b>
                </button>
              );
            })}
          </div>
        </section>

        <section className="pr-block">
          <h2 className="field__label">期間</h2>
          <div className="seg seg--3" role="radiogroup" aria-label="期間">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                className={`seg__btn${period === p ? " is-active" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p === "month" ? "1カ月" : p === "first" ? "前半" : "後半"}
              </button>
            ))}
          </div>
          <p className="field__hint">{PERIOD_LABEL[period]}</p>
        </section>

        <label className="pr-block field">
          <span className="field__label">ひとこと連絡（任意・紙の一番下に載ります）</span>
          <textarea
            className="input input--area"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="例：雨天の場合は、当日の朝6時までにLINEでお知らせします。"
          />
        </label>

        <h2 className="field__label pr-preview-label">見本（A4）</h2>
      </div>

      <div className="pr-fit" ref={box} style={{ height: height || undefined }}>
        <article className="pr-paper" ref={paper} style={{ width: PAPER_W, transform: `scale(${scale})` }}>
          <header className="pr-paper__head">
            <h2>{title}</h2>
          </header>
          {rows.length === 0 ? (
            <p className="pr-empty">この期間に載せる活動日がありません。</p>
          ) : (
            <table className="pl">
              <thead>
                <tr>
                  <th className="pl-day">日</th>
                  <th>予定</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date} className={`pl-row${r.weekend ? " pl-row--we" : ""}${r.quiet ? " pl-row--quiet" : ""}`}>
                    <td className="pl-day">
                      <b>{r.day}</b>
                      <span className={r.sat ? "pl-sat" : r.sun ? "pl-sun" : undefined}>{r.weekday}</span>
                    </td>
                    <td className="pl-main">
                      {r.reserves.map((x) => (
                        <div key={x.heading} className="pl-reserve">
                          <p className="pl-reserve__head">☂ {x.heading}</p>
                          <p>
                            <span>延期のとき</span>
                            {x.postponed}
                          </p>
                          {x.umpires && (
                            <p>
                              <span>延期の審判</span>
                              {x.umpires}
                            </p>
                          )}
                          <p>
                            <span>実施のとき</span>
                            <b>{x.held}</b>
                          </p>
                        </div>
                      ))}
                      {r.groups.map((g) => (
                        <Group key={g.key} g={g} />
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {message.trim() && <p className="pr-paper__msg">{message.trim()}</p>}
        </article>
      </div>

      <div className="pr-bar no-print">
        {pdfReady && (
          <button type="button" className="btn btn--line-red btn--block" onClick={send} disabled={busy || rows.length === 0}>
            {busy ? "PDFを作っています…" : needRetry ? "PDFを送る（もう一度押してください）" : "PDFでLINE・メールに送る"}
          </button>
        )}
        <button
          type="button"
          className={`btn btn--block${pdfReady ? "" : " btn--primary"}`}
          onClick={() => window.print()}
          disabled={rows.length === 0}
        >
          印刷{pdfReady ? "" : "（PDFで保存もできます）"}
        </button>
        {info && <p className="pr-info">{info}</p>}
        {!pdfReady && (
          <p className="pr-info">
            iPhoneでは、「印刷」を押したあと、共有ボタンから「PDFとして保存」またはLINEへ送れます。
          </p>
        )}
      </div>
    </>
  );
}
