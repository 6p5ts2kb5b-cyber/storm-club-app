// プライバシーポリシー（Googleログインの公開に必要なページ。ログインしなくても見られます）
import Link from "next/link";

export const metadata = { title: "プライバシーポリシー | STORMクラブ 運営管理" };

export default function PrivacyPage() {
  return (
    <div className="page doc-page">
      <h1 className="page-head__title">プライバシーポリシー</h1>
      <p className="muted">制定日：2026年10月1日</p>

      <h2>1. このアプリについて</h2>
      <p>
        「STORMクラブ 運営管理」（以下「本アプリ」）は、野球チームSTORMクラブのスタッフが、活動日・グラウンド・集合時間・指導者・審判などの準備状況を共有するためのアプリです。利用できるのは、STORMクラブの管理者が事前に登録したスタッフだけです。
      </p>

      <h2>2. 取得する情報</h2>
      <ul>
        <li>Googleアカウントでのログイン時に、Googleから提供されるメールアドレス・氏名・プロフィール画像</li>
        <li>スタッフが本アプリに入力した情報（活動日、グラウンド、試合、指導者・審判の担当など）</li>
      </ul>

      <h2>3. 利用目的</h2>
      <ul>
        <li>ログインした人が、登録済みのスタッフかどうかを確認するため</li>
        <li>STORMクラブの活動準備の情報を、スタッフ間で共有するため</li>
      </ul>

      <h2>4. 第三者への提供</h2>
      <p>
        取得した情報を、法令に基づく場合を除き、第三者に提供・販売することはありません。データはクラウドサービス（Supabase・Vercel）上に保存され、登録されたスタッフ以外は閲覧できないよう管理しています。
      </p>

      <h2>5. 情報の削除</h2>
      <p>登録の削除やデータの削除を希望される場合は、下記の連絡先までご連絡ください。</p>

      <h2>6. お問い合わせ</h2>
      <p>STORMクラブ 運営担当：barkatthesun2002@gmail.com</p>

      <p className="doc-back">
        <Link href="/login">‹ ログイン画面へ</Link>
      </p>
    </div>
  );
}
