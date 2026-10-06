// ログイン画面
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const ERRORS: Record<string, string> = {
  not_registered:
    "このGoogleアカウントは、STORMクラブのスタッフとして登録されていません。管理者に、ログインに使うGoogleのメールアドレスを伝えて登録してもらってください。",
  auth: "ログインが途中で止まりました。もう一度「Googleでログイン」を押してください。",
  setup: "データベースの準備がまだ終わっていないため、ログインできません。管理者に連絡してください。",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error ? ERRORS[error] ?? ERRORS.auth : null;

  return (
    <div className="login">
      <div className="login__card">
        <span className="brand-mark brand-mark--lg" aria-hidden="true">S</span>
        <h1 className="login__title">STORM</h1>
        <p className="login__sub">STORMクラブ 運営管理</p>

        {errorMessage && (
          <p className="login__error" role="alert">
            {errorMessage}
          </p>
        )}

        <GoogleLoginButton enabled={isSupabaseConfigured} />

        <p className="login__note">
          {isSupabaseConfigured
            ? "STORMクラブのスタッフとして登録されたGoogleアカウントだけが利用できます。"
            : "ログイン機能は準備中です（管理者がSupabaseの設定を終えると使えるようになります）。"}
        </p>
        <p className="login__links">
          <a href="/privacy">プライバシーポリシー</a>・<a href="/terms">利用規約</a>
        </p>
      </div>
    </div>
  );
}
