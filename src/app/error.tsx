"use client";

// 予期しないエラーが起きたときに表示する画面（初心者にも分かる言葉で）
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="empty">
        <p className="empty__title">画面を表示できませんでした</p>
        <p className="muted">
          インターネットの接続を確認して「もう一度読み込む」を押してください。何度も続く場合は、下の番号を管理者に伝えてください。
        </p>
        {error.digest && <p className="muted">エラー番号：{error.digest}</p>}
        <button type="button" className="btn btn--primary" onClick={() => reset()}>
          もう一度読み込む
        </button>
      </div>
    </div>
  );
}
