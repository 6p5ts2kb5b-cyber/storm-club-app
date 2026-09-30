import ComingSoon from "@/components/ComingSoon";

export default function SettingsPage() {
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-head__title">設定</h1>
      </header>
      <ComingSoon
        step="STEP2・11"
        title="アプリの設定"
        items={[
          "ログイン中のアカウントの表示とログアウト（STEP2）",
          "審判は試合開始の何分前集合か（初期値：60分前）（STEP11）",
          "12月〜4月をトップ・アカデミーにする自動判定（STEP5）",
        ]}
      />
      <p className="version">STORMクラブ運営アプリ v0.1（STEP1）</p>
    </div>
  );
}
