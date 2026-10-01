// 利用規約（Googleログインの公開に必要なページ。ログインしなくても見られます）
import Link from "next/link";

export const metadata = { title: "利用規約 | STORMクラブ 運営管理" };

export default function TermsPage() {
  return (
    <div className="page doc-page">
      <h1 className="page-head__title">利用規約</h1>
      <p className="muted">制定日：2026年10月1日</p>

      <h2>1. 利用できる人</h2>
      <p>
        「STORMクラブ 運営管理」（以下「本アプリ」）は、STORMクラブの管理者が登録したスタッフだけが利用できます。登録されていないGoogleアカウントではログインできません。
      </p>

      <h2>2. 利用のルール</h2>
      <ul>
        <li>本アプリの情報は、STORMクラブの活動の準備・運営のためだけに使ってください。</li>
        <li>本アプリに表示される情報（スタッフの氏名、活動予定など）を、許可なくクラブ外に公開しないでください。</li>
        <li>自分のGoogleアカウントを、ほかの人に使わせないでください。</li>
      </ul>

      <h2>3. 免責</h2>
      <p>
        本アプリはクラブ内の連絡を補助するためのものです。システムの不具合や通信の状況により、情報が正しく表示・保存されない場合があります。重要な連絡は、必要に応じて直接も確認してください。
      </p>

      <h2>4. 変更</h2>
      <p>この規約は、必要に応じて変更することがあります。</p>

      <h2>5. お問い合わせ</h2>
      <p>STORMクラブ 運営担当：barkatthesun2002@gmail.com</p>

      <p className="doc-back">
        <Link href="/login">‹ ログイン画面へ</Link>
      </p>
    </div>
  );
}
