// 読み込み中の表示：野球のボールがくるくる回りながら弾みます
export default function BallLoader({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="ball-loader" role="status" aria-live="polite">
      <div className="ball-loader__stage" aria-hidden="true">
        <svg className="ball-loader__ball" viewBox="0 0 64 64" width="64" height="64">
          <circle cx="32" cy="32" r="29" fill="#fbf7ea" stroke="#0e3b2e" strokeWidth="3" />
          <path d="M14 11c9 6 12 14 12 21s-3 15-12 21" fill="none" stroke="#c42b3b" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M50 11c-9 6-12 14-12 21s3 15 12 21" fill="none" stroke="#c42b3b" strokeWidth="2.6" strokeLinecap="round" />
          <g stroke="#c42b3b" strokeWidth="2" strokeLinecap="round">
            <path d="M14 17l5 1.5M16.5 24l5 1M17.5 31h5M16.5 38l5-1M14 45l5-1.5" />
            <path d="M50 17l-5 1.5M47.5 24l-5 1M46.5 31h-5M47.5 38l-5-1M50 45l-5-1.5" />
          </g>
        </svg>
        <span className="ball-loader__shadow" />
      </div>
      <p className="ball-loader__text">{label}</p>
    </div>
  );
}
