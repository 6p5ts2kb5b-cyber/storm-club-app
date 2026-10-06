"use client";

// スタッフマスター：一覧・追加・編集
// iPhoneで押しやすいよう、チェックボックスではなく大きなボタンで切り替えます。
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_STAFF,
  explainDbError,
  ROLE_LABEL,
  type Role,
  type Staff,
  type StaffInput,
  validateStaff,
} from "@/lib/staff";

type Filter = "active" | "coach" | "umpire" | "inactive";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "有効" },
  { key: "coach", label: "指導者" },
  { key: "umpire", label: "審判" },
  { key: "inactive", label: "無効" },
];

const ABILITIES: { key: "can_coach" | "can_umpire" | "can_plate" | "can_base"; label: string }[] = [
  { key: "can_coach", label: "指導者" },
  { key: "can_umpire", label: "審判" },
  { key: "can_plate", label: "球審" },
  { key: "can_base", label: "塁審" },
];

interface Toast {
  kind: "ok" | "ng";
  text: string;
}

export default function StaffManager({
  initial,
  isAdmin,
  demo = false,
}: {
  initial: Staff[];
  isAdmin: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState<Staff[]>(initial);
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<{ id: string | null; form: StaffInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => setList(initial), [initial]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const active = list.filter((s) => s.is_active);
  const shown = useMemo(() => {
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, "ja"));
    switch (filter) {
      case "active":
        return sorted.filter((s) => s.is_active);
      case "coach":
        return sorted.filter((s) => s.is_active && s.can_coach);
      case "umpire":
        return sorted.filter((s) => s.is_active && s.can_umpire);
      case "inactive":
      default:
        return sorted.filter((s) => !s.is_active);
    }
  }, [list, filter]);

  function openNew() {
    setFormError(null);
    setEditing({ id: null, form: { ...EMPTY_STAFF } });
  }

  function openEdit(s: Staff) {
    if (!isAdmin) return;
    const { id, ...rest } = s;
    setFormError(null);
    setEditing({ id, form: { ...rest, note: rest.note ?? "" } });
  }

  function update<K extends keyof StaffInput>(key: K, value: StaffInput[K]) {
    setEditing((e) => {
      if (!e) return e;
      const form = { ...e.form, [key]: value };
      // 審判をオフにしたら、球審・塁審もオフにする
      if (key === "can_umpire" && value === false) {
        form.can_plate = false;
        form.can_base = false;
      }
      // 球審・塁審をオンにしたら、審判もオンにする
      if ((key === "can_plate" || key === "can_base") && value === true) form.can_umpire = true;
      return { ...e, form };
    });
  }

  async function save() {
    if (!editing) return;
    const form: StaffInput = {
      ...editing.form,
      name: editing.form.name.trim(),
      email: editing.form.email.trim().toLowerCase(),
      note: editing.form.note?.trim() ? editing.form.note.trim() : null,
    };

    const problem = validateStaff(form);
    if (problem) {
      setFormError(problem);
      return;
    }

    // 管理者が0人になる変更は止める
    const before = editing.id ? list.find((s) => s.id === editing.id) : undefined;
    const losingAdmin = before?.role === "admin" && before.is_active && (form.role !== "admin" || !form.is_active);
    const otherAdmins = list.filter((s) => s.role === "admin" && s.is_active && s.id !== editing.id).length;
    if (losingAdmin && otherAdmins === 0) {
      setFormError("管理者が1人もいなくなるため、この変更はできません。先に別の人を管理者にしてください。");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      let saved: Staff;
      if (demo) {
        saved = { id: editing.id ?? `demo-${list.length + 1}-${form.email}`, ...form };
        if (list.some((s) => s.email === form.email && s.id !== saved.id)) {
          throw { message: "duplicate" };
        }
      } else {
        const supabase = createClient();
        const query = editing.id
          ? supabase.from("staff").update(form).eq("id", editing.id).select().single()
          : supabase.from("staff").insert(form).select().single();
        const { data, error } = await query;
        if (error) throw error;
        saved = data as Staff;
      }

      setList((l) => (editing.id ? l.map((s) => (s.id === saved.id ? saved : s)) : [...l, saved]));
      setEditing(null);
      setToast({ kind: "ok", text: demo ? "保存しました（お試しモード）" : "保存しました" });
      if (!demo) router.refresh();
    } catch (e) {
      const err = e as { message?: string; code?: string };
      setFormError(explainDbError(err.message ?? "", err.code));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="staff-summary">
        <div>
          <span className="staff-summary__num">{active.length}</span>
          <span className="staff-summary__label">有効</span>
        </div>
        <div>
          <span className="staff-summary__num">{active.filter((s) => s.can_coach).length}</span>
          <span className="staff-summary__label">指導者</span>
        </div>
        <div>
          <span className="staff-summary__num">{active.filter((s) => s.can_umpire).length}</span>
          <span className="staff-summary__label">審判</span>
        </div>
      </div>

      <div className="seg seg--4" role="tablist" aria-label="絞り込み">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`seg__btn${filter === f.key ? " is-active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isAdmin && (
        <button type="button" className="btn btn--primary btn--block add-btn" onClick={openNew}>
          ＋ スタッフを追加
        </button>
      )}

      {shown.length === 0 ? (
        <div className="empty">
          <p className="muted">該当するスタッフはいません。</p>
        </div>
      ) : (
        <ul className="staff-list">
          {shown.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`staff-card${s.is_active ? "" : " is-inactive"}`}
                onClick={() => openEdit(s)}
                disabled={!isAdmin}
              >
                <span className="staff-card__top">
                  <span className="staff-card__name">{s.name}</span>
                  <span className={`role-tag role-tag--${s.role}`}>{ROLE_LABEL[s.role]}</span>
                  {!s.is_active && <span className="role-tag">無効</span>}
                </span>
                <span className="staff-card__email">{s.email}</span>
                <span className="ability-row">
                  {ABILITIES.map((a) => (
                    <span key={a.key} className={`ability${s[a.key] ? " is-on" : ""}`}>
                      {a.label}
                    </span>
                  ))}
                </span>
                {s.note && <span className="staff-card__note">{s.note}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isAdmin && <p className="muted small-note">スタッフの追加・変更は管理者だけができます。</p>}

      {editing && (
        <div className="sheet-backdrop" role="presentation" onClick={() => !saving && setEditing(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={editing.id ? "スタッフを編集" : "スタッフを追加"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet__head">
              <h2 className="sheet__title">{editing.id ? "スタッフを編集" : "スタッフを追加"}</h2>
              <button type="button" className="sheet__close" onClick={() => setEditing(null)} disabled={saving} aria-label="閉じる">
                ×
              </button>
            </div>

            <label className="field">
              <span className="field__label">氏名</span>
              <input
                className="input"
                value={editing.form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="例：田中"
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span className="field__label">Googleメールアドレス</span>
              <input
                className="input"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={editing.form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="例：tanaka@gmail.com"
              />
              <span className="field__hint">この人がログインに使うGoogleアカウントのアドレス</span>
            </label>

            <div className="field">
              <span className="field__label">できること（タップで切り替え）</span>
              <div className="toggle-grid">
                {ABILITIES.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={`toggle${editing.form[a.key] ? " is-on" : ""}`}
                    aria-pressed={editing.form[a.key]}
                    onClick={() => update(a.key, !editing.form[a.key])}
                  >
                    <span className="toggle__mark" aria-hidden="true">{editing.form[a.key] ? "✓" : ""}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">アプリ権限</span>
              <div className="seg seg--3">
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`seg__btn${editing.form.role === r ? " is-active" : ""}`}
                    aria-pressed={editing.form.role === r}
                    onClick={() => update("role", r)}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <span className="field__hint">
                {editing.form.role === "admin"
                  ? "すべての操作ができます（スタッフ登録・活動日の作成や削除など）"
                  : editing.form.role === "staff"
                    ? "予定の確認と、グラウンド・指導者・審判の入力ができます"
                    : "予定を見ることだけができます"}
              </span>
            </div>

            <div className="field">
              <span className="field__label">状態</span>
              <div className="seg seg--2">
                <button
                  type="button"
                  className={`seg__btn${editing.form.is_active ? " is-active" : ""}`}
                  onClick={() => update("is_active", true)}
                >
                  有効
                </button>
                <button
                  type="button"
                  className={`seg__btn${!editing.form.is_active ? " is-active" : ""}`}
                  onClick={() => update("is_active", false)}
                >
                  無効（ログイン不可）
                </button>
              </div>
            </div>

            <label className="field">
              <span className="field__label">備考</span>
              <textarea
                className="input input--area"
                value={editing.form.note ?? ""}
                onChange={(e) => update("note", e.target.value)}
                rows={2}
                placeholder="任意"
              />
            </label>

            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="sheet__actions">
              <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>
                やめる
              </button>
              <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
                {saving ? "保存しています…" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status">
          {toast.kind === "ok" ? "✓ " : ""}
          {toast.text}
        </div>
      )}
    </>
  );
}
