// 写真・PDF・音声から予定を読み取って登録する（管理者だけ）
import Link from "next/link";
import ImportFlow from "@/components/ImportFlow";
import SampleBanner from "@/components/SampleBanner";
import { currentIsAdmin, loadDays } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [isAdmin, result] = await Promise.all([currentIsAdmin(), loadDays()]);

  return (
    <div className="page">
      <Link href="/activities" className="back-link">
        ‹ 活動一覧
      </Link>
      <header className="page-head">
        <h1 className="page-head__title">読み取って登録</h1>
        <p className="page-head__sub">大会の案内・LINEのスクショ・PDF・音声メモから、日時・集合時間・審判の人数を読み取ります。</p>
      </header>
      {!isSupabaseConfigured && <SampleBanner />}
      {isAdmin ? (
        <ImportFlow existing={result.ok ? result.data : []} demo={!isSupabaseConfigured} />
      ) : (
        <div className="empty">
          <p className="empty__title">読み取りは管理者だけが使えます</p>
        </div>
      )}
    </div>
  );
}
