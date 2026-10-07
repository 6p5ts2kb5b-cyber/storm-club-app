"use client";

// 決まっている内容をLINEの連絡文にして、そのまま送る／コピーする
import { useMemo, useState } from "react";
import { buildLineMessage, lineShareUrl } from "@/lib/line-text";
import type { UnitSummary } from "@/lib/status";

export default function LineShare({ date, unit }: { date: string; unit: UnitSummary }) {
  const auto = useMemo(() => buildLineMessage(date, unit), [date, unit]);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const text = edited ?? auto;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 古いブラウザ向け：文字を選択してコピー
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">LINEで連絡</h2>
      </div>
      <p className="muted line-note">決まっている内容から連絡文を作りました。文章は自由に直せます。</p>
      <textarea
        className="input input--area line-text"
        rows={Math.min(18, text.split("\n").length + 1)}
        value={text}
        onChange={(e) => setEdited(e.target.value)}
        aria-label="LINEで送る文章"
      />
      <div className="line-actions">
        <a className="btn btn--line" href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer">
          LINEで送る
        </a>
        <button type="button" className="btn" onClick={copy}>
          {copied ? "コピーしました ✓" : "コピー"}
        </button>
      </div>
      {edited !== null && edited !== auto && (
        <button type="button" className="btn btn--block btn--outline line-reset" onClick={() => setEdited(null)}>
          最新の内容に作り直す
        </button>
      )}
      <p className="field__hint">スマホではLINEが開くので、送り先のグループを選んでください。パソコンでは「コピー」して貼り付けるのが確実です。</p>
    </section>
  );
}
