"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" className="btn btn--block" onClick={logout} disabled={busy}>
      {busy ? "ログアウトしています…" : "ログアウト"}
    </button>
  );
}
