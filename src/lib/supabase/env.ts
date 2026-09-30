// Supabase（クラウドの倉庫）への接続情報
// 値はコードに書かず、Vercelの「環境変数」に登録します。
// NEXT_PUBLIC_ で始まる値は、ブラウザに渡しても安全な「公開用」の値です。

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** 接続情報が登録済みかどうか（未登録のあいだはログイン機能を止めて、画面だけ表示します） */
export const isSupabaseConfigured = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
