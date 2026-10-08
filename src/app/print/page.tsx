// 保護者配布用の「月間予定表」（表示・印刷・PDFでLINE送信）
import PrintSheet from "@/components/PrintSheet";
import SampleBanner from "@/components/SampleBanner";
import { loadDays } from "@/lib/data";
import { todayInTokyo } from "@/lib/divisions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function PrintPage() {
  const today = todayInTokyo();
  // 先月の1日から先の活動日を読み込む（先月〜3か月先を選べるように）
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const from = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  const result = await loadDays(from);

  return (
    <div className="page page--print">
      <header className="page-head no-print">
        <h1 className="page-head__title">保護者配布用の予定表</h1>
        <p className="page-head__sub">選ぶだけで、紙1枚の予定表ができます。印刷するか、PDFにしてLINEで送れます。</p>
      </header>
      {!isSupabaseConfigured && <SampleBanner />}
      {!result.ok ? (
        <div className="empty">
          <p className="form-error">{result.message}</p>
        </div>
      ) : (
        <PrintSheet days={result.data} today={today} />
      )}
    </div>
  );
}
