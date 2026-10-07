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

/** 順番に試すモデル（無料で使えるもの） */
const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-flash-latest"];

/**
 * いま使えるモデルを Google に問い合わせて、新しい「flash」から順に返す。
 * モデルが古くなって使えなくなっても、自動で新しいものを選べるようにするため。
 */
async function discoverModels(key: string): Promise<string[]> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": key },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const names = (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((n) => /^gemini-[\d.]+-flash(-lite)?$/.test(n));
    const ver = (n: string) => parseFloat(n.replace(/^gemini-/, "")) || 0;
    // 新しい版を先に、同じ版なら lite でない方を先に
    return names.sort((a, b) => ver(b) - ver(a) || Number(a.includes("lite")) - Number(b.includes("lite")));
  } catch {
    return [];
  }
}

/** Google から返ってきたエラー文の要点だけを取り出す */
function googleMessage(detail: string): string {
  try {
    const m = (JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? "";
    return m.split("\n")[0].slice(0, 120);
  } catch {
    return "";
  }
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

  // 混んでいる・モデルが見つからないときは、別のモデルで自動でやり直す
  const found = await discoverModels(key);
  const models = [
    ...new Set([process.env.GEMINI_MODEL, ...found.slice(0, 3), ...FALLBACK_MODELS].filter((m): m is string => Boolean(m))),
  ].slice(0, 4);
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  });
  const started = Date.now();

  let status = 0;
  let detail = "";
  let parsed: unknown = null;
  let gotAnswer = false;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // 無料枠はモデルごとに回数の枠が別なので、混雑・回数切れ・答えの崩れは、次のモデルで試す
  outer: for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() - started > 45_000) break outer; // 時間切れ（60秒）にならないように
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body,
        });
      } catch {
        status = 0;
        detail = "network";
        await sleep(800);
        continue;
      }

      if (res.ok) {
        const json = (await res.json().catch(() => null)) as {
          candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        } | null;
        const out = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        try {
          parsed = JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, ""));
          gotAnswer = true;
          break outer;
        } catch {
          console.error("Gemini bad JSON", model, json?.candidates?.[0]?.finishReason, out.slice(0, 200));
          status = 599;
          detail = `{"error":{"message":"答えの形が崩れました（${json?.candidates?.[0]?.finishReason ?? "?"}）"}}`;
          break; // 同じモデルでの再試行はせず、次のモデルへ
        }
      }

      const text = await res.text().catch(() => "");
      console.error("Gemini error", model, res.status, text.slice(0, 500));
      if (res.status !== 404 || status === 0 || status === 404) {
        status = res.status;
        detail = text;
      }
      // 鍵の間違い・ファイルの問題は、モデルを変えても同じなので止める
      if (res.status === 401 || res.status === 403 || /API key|API_KEY/i.test(text)) break outer;
      if (res.status === 400) break outer;
      // 混雑（500番台）は少し待って同じモデルでもう一度
      if (res.status >= 500 && attempt === 0) {
        await sleep(1200);
        continue;
      }
      break; // 404・429 などは次のモデルへ
    }
  }

  if (!gotAnswer) {
    const reason = googleMessage(detail);
    const tail = status ? `\n（くわしい原因：${status}${reason ? ` ${reason}` : ""}）` : "";
    if (status === 0) return fail("読み取りサービスにつながりませんでした。少し待ってから、もう一度お試しください。", 502);
    if (/API key|API_KEY/i.test(detail)) return fail("Gemini の鍵が正しくありません。Vercel に登録した GEMINI_API_KEY を確認してください。" + tail, 502);
    if (status === 403) return fail("Gemini の鍵が使えない状態です。Google AI Studio で鍵が有効か確認してください。" + tail, 502);
    if (status === 429) return fail("今日の無料の読み取り回数に達したか、短い時間に使いすぎました。しばらく待ってから、もう一度お試しください。" + tail, 429);
    if (status === 400) return fail("このファイルは読み取れませんでした。写真ならピントが合ったもの、音声ならm4a・mp3の形式でお試しください。" + tail, 400);
    if (status === 599) return fail("読み取った内容を整理できませんでした。もう一度お試しください。" + tail, 502);
    return fail("読み取りサービスが混み合っています。1〜2分待ってから、もう一度お試しください。" + tail, 502);
  }

  const result = normalize(parsed);
  return NextResponse.json({ ok: true, ...result });
}
