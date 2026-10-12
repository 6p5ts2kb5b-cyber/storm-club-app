"use client";

// 活動日の登録・編集パネル（下から出てくる入力画面）
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseQuick } from "@/lib/quick-input";
import { ACTIVITY_TYPES, createDay, deleteDay, type DayInput, type UnitInput, updateDay, validateDay } from "@/lib/activity-actions";
import type { StaffOption } from "@/lib/data";
import { autoModeForDate, DIVISION_LABEL, divisionsForMode, todayInTokyo, type DayMode, type Division } from "@/lib/divisions";
import type { DaySummary } from "@/lib/status";

const MODE_LABEL: Record<DayMode, string> = {
  single: "STORMクラブ",
  split: "トップ・アカデミー",
};

const ALL_DIVISIONS: Division[] = ["storm", "top", "academy"];

const blankUnit = (type = "練習試合"): UnitInput => ({ activityType: type, venue: "", gatherTime: "", umpireNeeded: 0, coachIds: [], note: "" });

function initialInput(day: DaySummary | undefined, defaultDate: string): DayInput {
  if (!day) {
    const units: Partial<Record<Division, UnitInput>> = {};
    ALL_DIVISIONS.forEach((d) => (units[d] = blankUnit()));
    return { date: defaultDate, mode: autoModeForDate(defaultDate), activityType: "練習試合", venues: {}, note: "", units };
  }
  const units: Partial<Record<Division, UnitInput>> = {};
  day.units.forEach(
    (u) =>
      (units[u.division] = {
        activityType: u.activityType || day.activityType || "練習試合",
        venue: u.venue ?? "",
        gatherTime: u.playerGatherTime ?? "",
        umpireNeeded: u.umpireRequired ? u.umpireNeeded : 0,
        coachIds: u.coachIds ?? [],
        note: u.note ?? "",
        firstGameStart: u.games.find((g) => g.no === 1)?.start?.slice(0, 5) ?? "",
      }),
  );
  // 区分を切り替えたときのために、ある区分の内容を、ない区分の初期値にも使う（指導者・審判は引き継がない）
  const base = day.units[0] ? units[day.units[0].division]! : blankUnit(day.activityType || "練習試合");
  ALL_DIVISIONS.forEach((d) => {
    if (!units[d]) units[d] = { ...base, coachIds: [], umpireNeeded: 0, note: "", firstGameStart: "" };
  });
  return { date: day.date, mode: day.mode, activityType: day.activityType || "練習試合", venues: {}, note: day.note ?? "", units };
}

export default function ActivityForm({
  day,
  defaultDate,
  demo,
  staff = [],
  onClose,
  onSaved,
}: {
  /** 編集するときは活動日、新しく作るときは空 */
  day?: DaySummary;
  defaultDate: string;
  demo: boolean;
  /** 指導者として選べるスタッフ */
  staff?: StaffOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState<DayInput>(() => initialInput(day, defaultDate));
  const [modeTouched, setModeTouched] = useState(Boolean(day));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quick, setQuick] = useState("");
  const [quickNotes, setQuickNotes] = useState<{ read: string[]; ignored: string[] } | null>(null);

  // 「ひとこと入力」を読み取って、フォームに入れる（保存はしません）
  function applyQuick() {
    const r = parseQuick(quick, todayInTokyo());
    const date = r.date ?? input.date;
    const mode: DayMode = r.split ? "split" : !modeTouched && r.date ? autoModeForDate(date) : input.mode;
    if (r.split) setModeTouched(true);
    setInput((i) => {
      const units = { ...(i.units ?? {}) };
      for (const d of ALL_DIVISIONS) {
        const q = { ...r.common, ...(r.byDivision[d] ?? {}) };
        const cur = units[d] ?? blankUnit();
        if (Object.keys(q).length === 0) continue;
        const coachIds = q.coachWords
          ? staff.filter((st) => st.is_active && st.can_coach && q.coachWords!.some((w) => st.name.includes(w))).map((st) => st.id)
          : cur.coachIds;
        units[d] = {
          ...cur,
          ...(q.activityType ? { activityType: q.activityType } : {}),
          ...(q.venue ? { venue: q.venue } : {}),
          ...(q.gatherTime ? { gatherTime: q.gatherTime } : {}),
          ...(q.umpireNeeded !== undefined ? { umpireNeeded: q.umpireNeeded } : {}),
          ...(q.umpireGatherTime ? { umpireGatherTime: q.umpireGatherTime } : {}),
          ...(q.firstGameStart ? { firstGameStart: q.firstGameStart } : {}),
          coachIds: q.coachWords && coachIds.length ? coachIds : cur.coachIds,
        };
      }
      return { ...i, date, mode, units };
    });
    setQuickNotes({ read: r.notes, ignored: r.ignored });
  }

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

  function setUnit(division: Division, patch: Partial<UnitInput>) {
    setInput((i) => ({ ...i, units: { ...i.units, [division]: { ...(i.units?.[division] ?? blankUnit()), ...patch } } }));
  }

  function toggleCoach(division: Division, id: string) {
    const cur = input.units?.[division]?.coachIds ?? [];
    setUnit(division, { coachIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
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

        <div className="field quick-input">
          <span className="field__label">ひとこと入力（任意）</span>
          <textarea
            className="input input--area"
            rows={2}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="例：11月3日 審判2名 審判7:30集合 生徒7:00集合 1試合目9:00開始"
          />
          <button type="button" className="btn btn--block" onClick={applyQuick} disabled={!quick.trim()}>
            読み取って下の入力欄に入れる
          </button>
          {quickNotes && (
            <p className="field__hint">
              {quickNotes.read.length ? `読み取り：${quickNotes.read.join("／")}。` : "読み取れる内容がありませんでした。"}
              {quickNotes.ignored.length ? ` 読み取れなかった時刻：${quickNotes.ignored.join("、")}。` : ""}
              内容を確認して「保存する」を押してください。
            </p>
          )}
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

        {divisions.map((d) => {
          const u = input.units?.[d] ?? blankUnit();
          const multi = divisions.length > 1;
          return (
            <section key={d} className={`form-unit form-unit--${d}`}>
              {multi && <h3 className="form-unit__title">{DIVISION_LABEL[d]}</h3>}

              <div className="field">
                <span className="field__label">活動内容</span>
                <div className="chip-grid">
                  {ACTIVITY_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`chip-btn${u.activityType === t ? " is-active" : ""}`}
                      aria-pressed={u.activityType === t}
                      onClick={() => setUnit(d, { activityType: t })}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="field__label">会場</span>
                <input
                  className="input"
                  value={u.venue}
                  onChange={(e) => setUnit(d, { venue: e.target.value })}
                  placeholder="例：坂戸中学校（未定なら空のまま）"
                />
              </label>

              <label className="field">
                <span className="field__label">選手集合時間（未定なら空のまま）</span>
                <input className="input" type="time" value={u.gatherTime} onChange={(e) => setUnit(d, { gatherTime: e.target.value })} />
              </label>

              <label className="field">
                <span className="field__label">1試合目の開始時間（未定なら空のまま）</span>
                <input className="input" type="time" value={u.firstGameStart ?? ""} onChange={(e) => setUnit(d, { firstGameStart: e.target.value })} />
              </label>

              <div className="field">
                <span className="field__label">審判の人数</span>
                <div className="chip-grid">
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`chip-btn${u.umpireNeeded === n ? " is-active" : ""}`}
                      aria-pressed={u.umpireNeeded === n}
                      onClick={() => setUnit(d, { umpireNeeded: n })}
                    >
                      {n === 0 ? "不要" : `${n}名`}
                    </button>
                  ))}
                </div>
                <span className="field__hint">審判の名前は、保存したあとの画面で入れます。</span>
              </div>

              {u.umpireNeeded > 0 && (
                <label className="field">
                  <span className="field__label">審判集合時間（空のままなら、試合時間から自動で決まります）</span>
                  <input className="input" type="time" value={u.umpireGatherTime ?? ""} onChange={(e) => setUnit(d, { umpireGatherTime: e.target.value })} />
                </label>
              )}

              {staff.length > 0 && (
                <div className="field">
                  <span className="field__label">指導者（出られる人を選ぶ）</span>
                  <div className="chip-grid">
                    {staff
                      .filter((st) => st.is_active && st.can_coach)
                      .map((st) => {
                        const on = (u.coachIds ?? []).includes(st.id);
                        return (
                          <button key={st.id} type="button" className={`chip-btn${on ? " is-active" : ""}`} aria-pressed={on} onClick={() => toggleCoach(d, st.id)}>
                            {st.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              <label className="field">
                <span className="field__label">{multi ? `${DIVISION_LABEL[d]}のメモ` : "この活動のメモ"}（任意）</span>
                <input className="input" value={u.note} onChange={(e) => setUnit(d, { note: e.target.value })} placeholder="持ち物・連絡など" />
              </label>
            </section>
          );
        })}

        <label className="field">
          <span className="field__label">{divisions.length > 1 ? "全体のメモ" : "メモ"}</span>
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
