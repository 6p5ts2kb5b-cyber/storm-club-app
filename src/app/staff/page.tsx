import ComingSoon from "@/components/ComingSoon";

export default function StaffPage() {
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-head__title">スタッフ</h1>
      </header>
      <ComingSoon
        step="STEP3"
        title="スタッフマスター"
        items={[
          "氏名・Googleメールアドレスを登録",
          "指導者／審判／球審／塁審 ができるかをスイッチで設定",
          "権限（管理者・スタッフ・閲覧のみ）を設定",
          "やめた人は削除せず「無効」に",
        ]}
      />
    </div>
  );
}
