"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleLoginButton({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" }, // 毎回アカウントを選べるように
        },
      });
      if (error) throw error;
      // このあとGoogleの画面へ自動で移動します
    } catch {
      setBusy(false);
      setMessage("Googleの画面を開けませんでした。インターネットの接続を確認して、もう一度押してください。");
    }
  }

  return (
    <>
      <button type="button" className="btn btn--google" onClick={login} disabled={!enabled || busy}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.6-2.8z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        {busy ? "Googleに移動しています…" : "Googleでログイン"}
      </button>
      {message && <p className="login__error">{message}</p>}
    </>
  );
}
