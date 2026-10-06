"use client";

// 「保存しました」などの短いお知らせを出すための部品
import { useCallback, useEffect, useState } from "react";

export interface ToastState {
  kind: "ok" | "ng";
  text: string;
}

export function useToast(): [React.ReactNode, (kind: "ok" | "ng", text: string) => void] {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "ok" ? 2400 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const show = useCallback((kind: "ok" | "ng", text: string) => setToast({ kind, text }), []);

  const el = toast ? (
    <div className={`toast toast--${toast.kind}`} role="status">
      <span className="toast__lamp" aria-hidden="true" />
      {toast.text}
    </div>
  ) : null;

  return [el, show];
}
