// ログイン画面（STEP2でGoogleログインを有効にします）
export default function LoginPage() {
  return (
    <div className="login">
      <div className="login__card">
        <span className="brand-mark brand-mark--lg" aria-hidden="true">S</span>
        <h1 className="login__title">STORMクラブ</h1>
        <p className="login__sub">運営管理アプリ</p>
        <button type="button" className="btn btn--google" disabled>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.6-2.8z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
          Googleでログイン
        </button>
        <p className="login__note">STEP2で使えるようになります。STORMクラブのスタッフとして登録されたアカウントだけが利用できます。</p>
      </div>
    </div>
  );
}
