// スタッフマスター画面
import StaffManager from "@/components/StaffManager";
import type { Staff } from "@/lib/staff";
import { SAMPLE_STAFF } from "@/lib/staff";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, getCurrentStaff } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  // Supabaseにつながる前は「お試しモード」（保存はされません）
  if (!isSupabaseConfigured) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-head__title">スタッフ</h1>
        </header>
        <p className="sample-banner" role="note">
          お試しモード：追加・変更は保存されません。
        </p>
        <StaffManager initial={SAMPLE_STAFF} isAdmin demo />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data, error }, me] = await Promise.all([
    supabase.from("staff").select("id,name,email,role,can_coach,can_umpire,can_plate,can_base,is_active,note").order("name"),
    getCurrentStaff(),
  ]);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-head__title">スタッフ</h1>
      </header>
      {error ? (
        <div className="empty">
          <p className="empty__title">スタッフの一覧を読み込めませんでした</p>
          <p className="muted">インターネットの接続を確認して、画面を下に引っぱって再読み込みしてください。</p>
        </div>
      ) : (
        <StaffManager initial={(data ?? []) as Staff[]} isAdmin={me?.role === "admin"} />
      )}
    </div>
  );
}
