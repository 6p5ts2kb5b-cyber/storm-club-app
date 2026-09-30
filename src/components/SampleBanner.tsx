// 「STEP1のサンプル表示です」のお知らせ帯
export default function SampleBanner({ step = "STEP4" }: { step?: string }) {
  return (
    <p className="sample-banner" role="note">
      いまは見た目確認用のサンプルを表示しています。{step}で本物のデータ（クラウド保存）に切り替わります。
    </p>
  );
}
