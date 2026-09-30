import type { Metadata, Viewport } from "next";
import AppNav from "@/components/AppNav";
import "./globals.css";

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
  themeColor: "#12284a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="app-shell">
          <AppNav />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
