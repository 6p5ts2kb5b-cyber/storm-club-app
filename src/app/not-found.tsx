import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <p>お探しのページが見つかりませんでした。</p>
        <p className="muted">アドレスが間違っているか、ページが削除された可能性があります。</p>
        <Link href="/" className="btn btn--primary">ホームへ戻る</Link>
      </div>
    </div>
  );
}
