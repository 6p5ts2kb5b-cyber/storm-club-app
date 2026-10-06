// スコアボードのカウントランプ（B・S・O）のように、準備状況を色で光らせる部品
// 🟢 完了・確定（緑） / 🟡 確認中（黄） / 🔴 未確定・不足（赤） / 対象外（消灯）
import type { Level } from "@/lib/status";

export const LEVEL_WORD: Record<Level, string> = {
  ok: "完了",
  warn: "確認中",
  ng: "未確定",
  none: "対象外",
};

export default function Lamp({ level, index = 0, labelled = false }: { level: Level; index?: number; labelled?: boolean }) {
  return (
    <span
      className={`lamp lamp--${level}`}
      style={{ ["--i" as string]: index }}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? LEVEL_WORD[level] : undefined}
      aria-hidden={labelled ? undefined : true}
    />
  );
}
