import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Zen_Kaku_Gothic_New } from "next/font/google";
import AppNav from "@/components/AppNav";
import "./globals.css";

// 日本語の本文・見出し
const sans = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  preload: false, // 日本語フォントは文字ごとに分割して読み込まれるため、先読みしない
  variable: "--font-sans",
});

// 日付・時刻・人数などの数字（球場のスコアボードの数字）
const num = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"], // 大きく表示するほど、看板らしい引き締まった形になる
  display: "swap",
  variable: "--font-num",
});

export const metadata: Metadata = {
  title: "STORMクラブ 運営管理",
  description: "STORMクラブの活動準備（グラウンド・集合時間・指導者・審判）をスタッフで共有するアプリ",
  appleWebApp: {
    capable: true,
    title: "STORM運営",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E3B2E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${sans.variable} ${num.variable}`}>
      <body>
        <div className="app-shell">
          <AppNav />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
