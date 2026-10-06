// ============================================================
// 読み取りの窓口：写真・PDF・音声・文章を受け取り、Gemini に読ませて予定の下書きを返す
// ・Gemini の鍵（GEMINI_API_KEY）はサーバーだけが持ち、ブラウザには渡しません
// ・使えるのは管理者だけです
// ============================================================

import { NextResponse } from "next/server";
import { todayInTokyo } from "@/lib/divisions";
import { buildPrompt, normalize, RESPONSE_SCHEMA } from "@/lib/extract";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4_200_000; // Vercel が1回に受け取れる量（約4.5MB）より少し小さく

/** iPhone のファイルの種類名を、Gemini が分かる名前にそろえる */
function geminiMime(type: string, name: string): string | null {
  const t = type.toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (t.startsWith("image/")) return ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(t) ? t : "image/jpeg";
  if (t === "application/pdf" || ext === "pdf") return "application/pdf";
  if (t.startsWith("audio/") || ["m4a", "mp3", "wav", "aac", "ogg", "flac", "webm", "opus", "caf"].includes(ext)) {
    if (["audio/x-m4a", "audio/mp4", "audio/m4a"].includes(t) || ext === "m4a") return "audio/m4a";
    if (t === "audio/mpeg" || ext === "mp3") return "audio/mp3";
    if (t === "audio/x-wav" || t === "audio/wav" || ext === "wav") return "audio/wav";
    if (ext === "aac" || t === "audio/aac") return "audio/aac";
    if (ext === "ogg" || t === "audio/ogg") return "audio/ogg";
    if (ext === "flac") return "audio/flac";
    if (ext === "webm" || t === "audio/webm") return "audio/webm";
    if (ext === "opus") return "audio/opus";
    return null;
  }
  return null;
}

const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(request: Request) {
  // 管理者だけ
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) return fail("読み取りは管理者だけが使えます。", 403);
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return fail("読み取りの準備がまだです。管理者が Gemini の鍵（GEMINI_API_KEY）を Vercel に登録すると使えるようになります。", 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("ファイルが大きすぎるか、送信が途中で止まりました。ファイルを減らして、もう一度お試しください。", 413);
  }

  const parts: Record<string, unknown>[] = [{ text: buildPrompt(todayInTokyo()) }];
  const memo = String(form.get("text") ?? "").trim();
  if (memo) parts.push({ text: `【貼り付けられた文章】\n${memo.slice(0, 20000)}` });

  let total = 0;
  for (const f of form.getAll("files")) {
    if (!(f instanceof File) || f.size === 0) continue;
    const mime = geminiMime(f.type, f.name);
    if (!mime) return fail(`「${f.name}」は読み取れない種類のファイルです。写真・PDF・音声を選んでください。`);
    total += f.size;
    if (total > MAX_BYTES) {
      return fail("ファイルの合計が大きすぎます（約4MBまで）。音声は短く区切るか、ファイルを分けて読み取ってください。", 413);
    }
    const data = Buffer.from(await f.arrayBuffer()).toString("base64");
    parts.push({ inline_data: { mime_type: mime, data } });
  }
  if (parts.length === 1) return fail("写真・PDF・音声を選ぶか、文章を貼り付けてください。");

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      }),
    });
  } catch {
    return fail("読み取りサービスにつながりませんでした。少し待ってから、もう一度お試しください。", 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Gemini error", res.status, detail.slice(0, 500));
    if (res.status === 429) return fail("今日の無料の読み取り回数に達したか、短い時間に使いすぎました。しばらく待ってから、もう一度お試しください。", 429);
    if (res.status === 400 && /API key/i.test(detail)) return fail("Gemini の鍵が正しくありません。Vercel に登録した GEMINI_API_KEY を確認してください。", 502);
    if (res.status === 400) return fail("このファイルは読み取れませんでした。写真ならピントが合ったもの、音声ならm4a・mp3の形式でお試しください。", 400);
    return fail("読み取りに失敗しました。少し待ってから、もう一度お試しください。", 502);
  }

  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const out = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(out);
  } catch {
    return fail("読み取った内容を整理できませんでした。もう一度お試しください。", 502);
  }

  const result = normalize(parsed);
  return NextResponse.json({ ok: true, ...result });
}
