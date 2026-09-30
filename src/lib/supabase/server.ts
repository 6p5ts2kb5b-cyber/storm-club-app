// サーバー側（画面を組み立てるとき）から Supabase を使うための接続
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 画面の組み立て中はクッキーを書き換えられないことがあります。
          // ログイン状態の更新は middleware が行うので、ここでは無視して大丈夫です。
        }
      },
    },
  });
}

/** ログイン中のスタッフ情報（スタッフマスターに登録された本人の行） */
export interface CurrentStaff {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "viewer";
}

export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_staff").maybeSingle();
  if (error || !data) return null;
  return data as CurrentStaff;
}
