"use client";

// 「＋活動日を追加」「編集」などのボタンと、押したときに出る入力パネル
import { useState } from "react";
import ActivityForm from "@/components/ActivityForm";
import { useToast } from "@/components/useToast";
import type { DaySummary } from "@/lib/status";

export default function ActivityFormButton({
  label,
  className = "btn btn--primary",
  day,
  defaultDate,
  demo,
}: {
  label: string;
  className?: string;
  day?: DaySummary;
  defaultDate: string;
  demo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [toastEl, showToast] = useToast();

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <ActivityForm
          day={day}
          defaultDate={defaultDate}
          demo={demo}
          onClose={() => setOpen(false)}
          onSaved={(m) => showToast("ok", m)}
        />
      )}
      {toastEl}
    </>
  );
}
