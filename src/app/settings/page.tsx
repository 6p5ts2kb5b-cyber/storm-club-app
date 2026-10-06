import LogoutButton from "@/components/LogoutButton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentStaff } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { admin: "管理者", staff: "スタッフ", viewer: "閲覧のみ" } as const;

export default async function SettingsPage() {
  const me = isSupabaseConfigured ? await getCurrentStaff() : null;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-head__title">設定</h1>
      </header>

      <section className="panel">
        <h2 className="panel__title">ログイン中のアカウント</h2>
        {me ? (
          <>
            <dl className="kv">
              <div>
                <dt>名前</dt>
                <dd>{me.name}</dd>
              </div>
              <div>
                <dt>メール</dt>
                <dd>{me.email}</dd>
              </div>
              <div>
                <dt>権限</dt>
                <dd>
                  <span className={`role-tag role-tag--${me.role}`}>{ROLE_LABEL[me.role]}</span>
                </dd>
              </div>
            </dl>
            <LogoutButton />
          </>
        ) : (
          <p className="muted">ログイン機能は準備中です。</p>
        )}
      </section>

      <section className="panel settings-note">
        <h2 className="panel__title">活動ごとの設定</h2>
        <p className="muted">
          審判の「何分前に集合するか」と、トップ・アカデミーかSTORMクラブかの区分は、活動日ごとに決められます。活動日の画面から変更してください。
        </p>
      </section>
      <p className="version">STORMクラブ 運営管理 v1.0</p>
    </div>
  );
}
