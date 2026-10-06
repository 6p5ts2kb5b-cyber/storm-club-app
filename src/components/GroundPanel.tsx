"use client";

// グラウンド管理：候補校の一覧・追加・編集・使用決定
import Lamp from "@/components/Lamp";
import { useState } from "react";
import { deleteGround, saveGround, validateGround } from "@/lib/ground-actions";
import {
  EMPTY_GROUND,
  type Ground,
  type GroundInput,
  type GroundStatus,
  SCHOOL_USE_LABEL,
  type SchoolUse,
  sortGrounds,
  STATUS_LABEL,
  STORM_USE_LABEL,
  type StormUse,
} from "@/lib/grounds";

const STATUS_ORDER: GroundStatus[] = ["candidate", "checking", "available", "unavailable", "decided"];

export default function GroundPanel({
  unitId,
  grounds,
  canEdit,
  demo,
  onChange,
  notify,
}: {
  unitId?: string;
  grounds: Ground[];
  canEdit: boolean;
  demo: boolean;
  onChange: (next: Ground[]) => void;
  notify: (kind: "ok" | "ng", text: string) => void;
}) {
  const [editing, setEditing] = useState<{ id: string | null; form: GroundInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const usable = grounds.filter((g) => g.status !== "unavailable").length;

  /** 保存結果を一覧に反映（決定は1校だけ） */
  function apply(saved: Ground) {
    let next = grounds.some((g) => g.id === saved.id)
      ? grounds.map((g) => (g.id === saved.id ? saved : g))
      : [...grounds, saved];
    if (saved.status === "decided") {
      next = next.map((g) => (g.id !== saved.id && g.status === "decided" ? { ...g, status: "available" as const } : g));
    }
    onChange(sortGrounds(next));
  }

  async function persist(id: string | null, form: GroundInput): Promise<boolean> {
    const problem = validateGround(form);
    if (problem) {
      setFormError(problem);
      return false;
    }
    if (demo || !unitId) {
      apply({ id: id ?? `demo-g-${Date.now()}`, ...form, school_name: form.school_name.trim() });
      notify("ok", "保存しました（お試しモード）");
      return true;
    }
    setBusy(true);
    const result = await saveGround(unitId, id, form);
    setBusy(false);
    if (!result.ok) {
      setFormError(result.message);
      notify("ng", result.message);
      return false;
    }
    if (result.ground) apply(result.ground);
    notify("ok", "保存しました");
    return true;
  }

  async function decide(g: Ground) {
    const { id, ...rest } = g;
    await persist(id, { ...rest, status: "decided", storm_use: rest.storm_use === "unknown" ? "ok" : rest.storm_use });
  }

  async function save() {
    if (!editing) return;
    setFormError(null);
    if (await persist(editing.id, editing.form)) setEditing(null);
  }

  async function remove() {
    if (!editing?.id) return;
    if (!window.confirm(`「${editing.form.school_name}」を候補から削除しますか？`)) return;
    if (demo) {
      onChange(grounds.filter((g) => g.id !== editing.id));
      notify("ok", "削除しました（お試しモード）");
      setEditing(null);
      return;
    }
    setBusy(true);
    const result = await deleteGround(editing.id);
    setBusy(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    onChange(grounds.filter((g) => g.id !== editing.id));
    notify("ok", "削除しました");
    setEditing(null);
  }

  function update<K extends keyof GroundInput>(key: K, value: GroundInput[K]) {
    setEditing((e) => {
      if (!e) return e;
      const form = { ...e.form, [key]: value };
      // STORMが使えるかに合わせて、状態を自動で進める（決定済みは変えない）
      if (key === "storm_use" && form.status !== "decided") {
        if (value === "ng") form.status = "unavailable";
        if (value === "ok" && (form.status === "candidate" || form.status === "checking" || form.status === "unavailable")) {
          form.status = "available";
        }
      }
      return { ...e, form };
    });
  }

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">グラウンド</h2>
        <span className={`count-badge${usable === 0 ? " count-badge--ng" : ""}`}>候補 {usable}校</span>
      </div>

      {grounds.length === 0 ? (
        <p className="ground-empty">
          <Lamp level="ng" />
          まだ候補がありません。下のボタンから登録してください。
        </p>
      ) : (
        <ul className="ground-list">
          {grounds.map((g) => (
            <li key={g.id} className={`ground ground--${g.status}`}>
              <button
                type="button"
                className="ground__body"
                onClick={() => {
                  if (!canEdit) return;
                  const { id, ...rest } = g;
                  setFormError(null);
                  setEditing({ id, form: { ...rest, ground_name: rest.ground_name ?? "", note: rest.note ?? "" } });
                }}
                disabled={!canEdit}
              >
                <span className="ground__top">
                  <span className="ground__name">
                    {g.school_name}
                    {g.ground_name && <span className="ground__sub">{g.ground_name}</span>}
                  </span>
                  <span className={`gstatus gstatus--${g.status}`}>{STATUS_LABEL[g.status]}</span>
                </span>
                <span className="ground__facts">
                  <span>
                    学校使用：<b>{SCHOOL_USE_LABEL[g.school_use]}</b>
                  </span>
                  <span>
                    STORM使用：
                    <b className={g.storm_use === "ng" ? "txt-ng" : g.storm_use === "ok" ? "txt-ok" : ""}>
                      {STORM_USE_LABEL[g.storm_use]}
                    </b>
                  </span>
                </span>
                {g.note && <span className="ground__note">{g.note}</span>}
              </button>
              {canEdit && g.status !== "decided" && g.status !== "unavailable" && (
                <button type="button" className="ground__decide" onClick={() => decide(g)} disabled={busy}>
                  ここに
                  <br />
                  決定
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <button
          type="button"
          className="btn btn--block btn--outline"
          onClick={() => {
            setFormError(null);
            setEditing({ id: null, form: { ...EMPTY_GROUND } });
          }}
        >
          ＋ 候補グラウンドを追加
        </button>
      )}

      {editing && (
        <div className="sheet-backdrop" role="presentation" onClick={() => !busy && setEditing(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2 className="sheet__title">{editing.id ? "グラウンドを編集" : "候補グラウンドを追加"}</h2>
              <button type="button" className="sheet__close" onClick={() => setEditing(null)} disabled={busy} aria-label="閉じる">
                ×
              </button>
            </div>

            <label className="field">
              <span className="field__label">学校名</span>
              <input
                className="input"
                value={editing.form.school_name}
                onChange={(e) => update("school_name", e.target.value)}
                placeholder="例：坂戸中学校"
              />
            </label>

            <label className="field">
              <span className="field__label">グラウンド名（任意）</span>
              <input
                className="input"
                value={editing.form.ground_name ?? ""}
                onChange={(e) => update("ground_name", e.target.value)}
                placeholder="例：第2グラウンド"
              />
            </label>

            <div className="field">
              <span className="field__label">学校側の使用予定</span>
              <div className="seg seg--3">
                {(Object.keys(SCHOOL_USE_LABEL) as SchoolUse[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`seg__btn${editing.form.school_use === k ? " is-active" : ""}`}
                    aria-pressed={editing.form.school_use === k}
                    onClick={() => update("school_use", k)}
                  >
                    {SCHOOL_USE_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">STORMが使えるか</span>
              <div className="seg seg--3">
                {(Object.keys(STORM_USE_LABEL) as StormUse[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`seg__btn${editing.form.storm_use === k ? " is-active" : ""}`}
                    aria-pressed={editing.form.storm_use === k}
                    onClick={() => update("storm_use", k)}
                  >
                    {STORM_USE_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">状態</span>
              <div className="chip-grid">
                {STATUS_ORDER.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`chip-btn chip-btn--${st}${editing.form.status === st ? " is-active" : ""}`}
                    aria-pressed={editing.form.status === st}
                    onClick={() => update("status", st)}
                  >
                    {STATUS_LABEL[st]}
                  </button>
                ))}
              </div>
              <span className="field__hint">「使用決定」は1校だけ。別の学校に決定すると、前の学校は「使用可能」に戻ります。</span>
            </div>

            <label className="field">
              <span className="field__label">備考</span>
              <textarea
                className="input input--area"
                rows={2}
                value={editing.form.note ?? ""}
                onChange={(e) => update("note", e.target.value)}
                placeholder="例：教頭先生に確認中、17時以降に返事"
              />
            </label>

            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}

            {editing.id && (
              <button type="button" className="btn btn--danger btn--block" onClick={remove} disabled={busy}>
                候補から削除
              </button>
            )}

            <div className="sheet__actions">
              <button type="button" className="btn" onClick={() => setEditing(null)} disabled={busy}>
                やめる
              </button>
              <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? "保存しています…" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
