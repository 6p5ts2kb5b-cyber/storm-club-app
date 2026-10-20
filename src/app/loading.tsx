import BallLoader from "@/components/BallLoader";

// 画面を切りかえて読み込んでいる間に出ます
export default function Loading() {
  return (
    <div className="page">
      <BallLoader />
    </div>
  );
}
