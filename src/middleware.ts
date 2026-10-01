// ============================================================
// 入口の見張り番（middleware）
// すべての画面を開く前に、ここで次の2つを確認します。
//   1. Googleでログインしているか
//   2. そのメールアドレスがスタッフマスターに「有効」で登録されているか
// どちらかがダメなら、ログイン画面へ案内します。
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  // Supabaseの接続情報がまだ登録されていない間は、画面だけ表示する（STEP1の状態）
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // ログイン情報が途中のサーバーに保存されないようにする指示
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // ログイン状態を確認（期限切れならここで自動更新されます）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");

  /** ログイン状態のクッキーを引き継いだまま別の画面へ移動させる */
  const redirectTo = (target: string) => {
    const dest = request.nextUrl.clone();
    const [pathname, query] = target.split("?");
    dest.pathname = pathname;
    dest.search = query ? `?${query}` : "";
    const res = NextResponse.redirect(dest);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // 未ログイン → ログイン画面へ
  if (!user) {
    return isPublic ? response : redirectTo("/login");
  }

  // ログイン済み → スタッフマスターに登録されているか確認
  const { data: isStaff, error } = await supabase.rpc("is_staff");

  if (error || isStaff !== true) {
    await supabase.auth.signOut();
    if (path.startsWith("/login")) return response;
    return redirectTo(error ? "/login?error=setup" : "/login?error=not_registered");
  }

  // 登録済みのスタッフがログイン画面を開いたらホームへ
  if (path.startsWith("/login")) return redirectTo("/");

  return response;
}

export const config = {
  // 画像やアイコンなどのファイルは確認しない
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
