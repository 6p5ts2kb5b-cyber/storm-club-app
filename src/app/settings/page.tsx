import ComingSoon from "@/components/ComingSoon";
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

      <ComingSoon
        step="STEP5・11"
        title="アプリの設定"
        items={[
          "審判は試合開始の何分前集合か（初期値：60分前）（STEP11）",
          "12月〜4月をトップ・アカデミーにする自動判定（STEP5）",
        ]}
      />
      <p className="version">STORMクラブ運営アプリ v0.2（STEP2）</p>
    </div>
  );
}
