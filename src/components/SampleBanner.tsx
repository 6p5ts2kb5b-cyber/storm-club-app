// お試しモードのお知らせ帯
export default function SampleBanner() {
  return (
    <p className="sample-banner" role="note">
      お試しモード：サンプルを表示しています。追加・変更は保存されません（ログインの設定が終わると、クラウドに保存される本物のデータに切り替わります）。
    </p>
  );
}
