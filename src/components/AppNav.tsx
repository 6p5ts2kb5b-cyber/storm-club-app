"use client";

// 画面の移動メニュー
// iPhone：画面の下に5つの大きなボタン（親指で押しやすい位置）
// PC   ：画面の左側に縦に並べる

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "ホーム",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "カレンダー",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/activities",
    label: "活動一覧",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1.2" />
        <circle cx="4.5" cy="12" r="1.2" />
        <circle cx="4.5" cy="18" r="1.2" />
      </svg>
    ),
  },
  {
    href: "/staff",
    label: "名簿",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M17 14.5c2.2 0 3.9 1.4 4.5 4" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "設定",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav() {
  const pathname = usePathname() ?? "/";

  // ログイン画面ではメニューを出さない
  if (pathname.startsWith("/login") || pathname.startsWith("/privacy") || pathname.startsWith("/terms")) return null;

  return (
    <nav className="app-nav" aria-label="メインメニュー">
      <div className="app-nav__brand">
        <span className="wordmark">STORM</span>
        <span className="app-nav__brand-text">運営管理</span>
      </div>
      <ul className="app-nav__list">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`app-nav__link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
