"use client";

// 活動日の登録・編集パネル（下から出てくる入力画面）
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACTIVITY_TYPES, createDay, deleteDay, type DayInput, updateDay, validateDay } from "@/lib/activity-actions";
import { autoModeForDate, DIVISION_LABEL, divisionsForMode, type DayMode, type Division } from "@/lib/divisions";
import type { DaySummary } from "@/lib/status";

const MODE_LABEL: Record<DayMode, string> = {
  single: "STORMクラブ",
  split: "トップ・アカデミー",
};

function initialInput(day: DaySummary | undefined, defaultDate: string): DayInput {
  if (!day) {
    return { date: defaultDate, mode: autoModeForDate(defaultDate), activityType: "練習試合", venues: {}, note: "" };
  }
  const venues: Partial<Record<Division, string>> = {};
  day.units.forEach((u) => (venues[u.division] = u.venue ?? ""));
  // 区分を切り替えたときのために、STORMの会場をトップ・アカデミーの初期値にも使う
  if (day.mode === "single" && venues.storm) {
    venues.top = venues.storm;
    venues.academy = venues.storm;
  }
  return { date: day.date, mode: day.mode, activityType: day.activityType || "練習試合", venues, note: day.note ?? "" };
}

export default function ActivityForm({
  day,
  defaultDate,
  demo,
  onClose,
  onSaved,
}: {
  /** 編集するときは活動日、新しく作るときは空 */
  day?: DaySummary;
  defaultDate: string;
  demo: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState<DayInput>(() => initialInput(day, defaultDate));
  const [modeTouched, setModeTouched] = useState(Boolean(day));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(day);
  const autoMode = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? autoModeForDate(input.date) : input.mode;

  function setDate(date: string) {
    setInput((i) => ({
      ...i,
      date,
      // 区分を手で変えていなければ、日付に合わせて自動で切り替える
      mode: !modeTouched && /^\d{4}-\d{2}-\d{2}$/.test(date) ? autoModeForDate(date) : i.mode,
    }));
  }

  function setMode(mode: DayMode) {
    setModeTouched(true);
    setInput((i) => ({ ...i, mode }));
  }

  function setVenue(division: Division, value: string) {
    setInput((i) => ({ ...i, venues: { ...i.venues, [division]: value } }));
  }

  async function save() {
    const problem = validateDay(input);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);

    if (demo) {
      setBusy(false);
      onSaved("保存しました（お試しモードのため記録はされません）");
      onClose();
      return;
    }

    const result = isEdit && day?.id ? await updateDay(day.id, input) : await createDay(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved("保存しました");
    onClose();
    router.push(`/activities/${input.date}`);
    router.refresh();
  }

  async function remove() {
    if (!day) return;
    const ok = window.confirm(
      `${input.date} の活動を削除します。\nグラウンド・指導者・審判など、この日に入力した内容もすべて消えます。\nよろしいですか？`,
    );
    if (!ok) return;

    if (demo) {
      onSaved("削除しました（お試しモードのため実際には消えません）");
      onClose();
      return;
    }
    if (!day.id) return;
    setBusy(true);
    const result = await deleteDay(day.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved("削除しました");
    onClose();
    router.push("/activities");
    router.refresh();
  }

  const divisions = divisionsForMode(input.mode);

  return (
    <div className="sheet-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "活動日を編集" : "活動日を追加"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__head">
          <h2 className="sheet__title">{isEdit ? "基本情報を編集" : "活動日を追加"}</h2>
          <button type="button" className="sheet__close" onClick={onClose} disabled={busy} aria-label="閉じる">
            ×
          </button>
        </div>

        <label className="field">
          <span className="field__label">日付</span>
          <input className="input" type="date" value={input.date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="field">
          <span className="field__label">活動区分</span>
          <div className="seg seg--2">
            {(["single", "split"] as DayMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`seg__btn${input.mode === m ? " is-active" : ""}`}
                aria-pressed={input.mode === m}
                onClick={() => setMode(m)}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <span className="field__hint">
            {input.mode === autoMode
              ? `日付から自動で選びました（12月〜4月はトップ・アカデミー、5月〜11月はSTORMクラブ）`
              : `手動で変更しています（この日付の自動判定は「${MODE_LABEL[autoMode]}」）`}
          </span>
        </div>

        <div className="field">
          <span className="field__label">活動内容</span>
          <div className="chip-grid">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip-btn${input.activityType === t ? " is-active" : ""}`}
                aria-pressed={input.activityType === t}
                onClick={() => setInput((i) => ({ ...i, activityType: t }))}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {divisions.map((d) => (
          <label key={d} className="field">
            <span className="field__label">{divisions.length > 1 ? `${DIVISION_LABEL[d]}の会場` : "会場"}</span>
            <input
              className="input"
              value={input.venues[d] ?? ""}
              onChange={(e) => setVenue(d, e.target.value)}
              placeholder="例：坂戸中学校（未定なら空のまま）"
            />
          </label>
        ))}

        <label className="field">
          <span className="field__label">メモ</span>
          <textarea
            className="input input--area"
            rows={2}
            value={input.note}
            onChange={(e) => setInput((i) => ({ ...i, note: e.target.value }))}
            placeholder="任意"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {isEdit && (
          <button type="button" className="btn btn--danger btn--block" onClick={remove} disabled={busy}>
            この活動日を削除
          </button>
        )}

        <div className="sheet__actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            やめる
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? "保存しています…" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
