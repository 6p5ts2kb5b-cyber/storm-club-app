"use client";

// 名簿：審判名簿・指導者名簿・ログイン名簿
//   審判名簿・指導者名簿 … ログインしない人も名前だけで登録。名前をまとめて手打ちで追加できる
//   ログイン名簿       … Googleのメールアドレスを登録した人だけがアプリにログインできる
// 同じ人が複数の名簿に入れます（例：田中さんはログインもでき、審判もする）。
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/useToast";
import { createClient } from "@/lib/supabase/client";
import {
  canLogin,
  explainDbError,
  parseNames,
  ROLE_LABEL,
  type Role,
  ROSTER_LABEL,
  type RosterKind,
  type Staff,
  type StaffInput,
  validateStaff,
} from "@/lib/staff";

const TABS: RosterKind[] = ["umpire", "coach", "login"];

type Patch = Partial<StaffInput>;

export default function Rosters({ initial, isAdmin, demo = false }: { initial: Staff[]; isAdmin: boolean; demo?: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<Staff[]>(initial);
  const [tab, setTab] = useState<RosterKind>("umpire");
  const [quick, setQuick] = useState("");
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState<Staff | null>(null);
  const [login, setLogin] = useState<{ id: string | null; form: StaffInput } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastEl, showToast] = useToast();

  useEffect(() => setList(initial), [initial]);

  const sorted = useMemo(() => [...list].sort((a, b) => a.name.localeCompare(b.name, "ja")), [list]);
  const umpires = sorted.filter((s) => s.is_active && s.can_umpire);
  const coaches = sorted.filter((s) => s.is_active && s.can_coach);
  const logins = sorted.filter((s) => canLogin(s));
  const count: Record<RosterKind, number> = { umpire: umpires.length, coach: coaches.length, login: logins.filter((s) => s.is_active).length };

  // ---------- 保存の共通処理 ----------
  async function update(id: string, patch: Patch): Promise<Staff | null> {
    if (demo) {
      const cur = list.find((s) => s.id === id);
      return cur ? { ...cur, ...patch } : null;
    }
    const { data, error } = await createClient().from("staff").update(patch).eq("id", id).select().single();
    if (error) {
      showToast("ng", explainDbError(error.message, error.code));
      return null;
    }
    return data as Staff;
  }

  async function insert(rows: StaffInput[]): Promise<Staff[] | null> {
    if (demo) return rows.map((r, i) => ({ id: `demo-${Date.now()}-${i}`, ...r }));
    const { data, error } = await createClient().from("staff").insert(rows).select();
    if (error) {
      showToast("ng", explainDbError(error.message, error.code));
      return null;
    }
    return data as Staff[];
  }

  function apply(saved: Staff[]) {
    setList((l) => {
      const map = new Map(l.map((s) => [s.id, s]));
      saved.forEach((s) => map.set(s.id, s));
      return [...map.values()];
    });
  }

  const done = (text: string) => {
    showToast("ok", demo ? `${text}（お試しモード）` : text);
    if (!demo) router.refresh();
  };

  // ---------- 名前をまとめて追加 ----------
  async function quickAdd(kind: "umpire" | "coach") {
    const names = parseNames(quick);
    if (names.length === 0) return;
    setBusy(true);
    const flag: Patch =
      kind === "umpire" ? { can_umpire: true, can_plate: true, can_base: true, is_active: true } : { can_coach: true, is_active: true };

    const saved: Staff[] = [];
    const newRows: StaffInput[] = [];
    for (const name of names) {
      // 同じ名前の人がいれば、その人をこの名簿にも入れる（重複して作らない）
      const same = list.find((s) => s.name === name);
      if (same) {
        const keep: Patch = kind === "umpire" && same.can_umpire ? { is_active: true } : flag;
        const r = await update(same.id, keep);
        if (r) saved.push(r);
      } else {
        newRows.push({
          name,
          email: null,
          role: "staff",
          can_coach: kind === "coach",
          can_umpire: kind === "umpire",
          can_plate: kind === "umpire",
          can_base: kind === "umpire",
          is_active: true,
          note: null,
        });
      }
    }
    if (newRows.length) {
      const r = await insert(newRows);
      if (r) saved.push(...r);
    }
    setBusy(false);
    if (saved.length) {
      apply(saved);
      setQuick("");
      done(`${ROSTER_LABEL[kind]}に${saved.length}人を追加しました`);
    }
  }

  // ---------- 球審・塁審のチェック ----------
  async function toggle(s: Staff, key: "can_plate" | "can_base") {
    if (!isAdmin) return;
    const next = !s[key];
    apply([{ ...s, [key]: next }]);
    const r = await update(s.id, { [key]: next });
    if (r) {
      apply([r]);
      if (!demo) router.refresh();
    } else apply([s]);
  }

  // ---------- 名簿から外す ----------
  async function removeFrom(s: Staff, kind: "umpire" | "coach") {
    const patch: Patch = kind === "umpire" ? { can_umpire: false, can_plate: false, can_base: false } : { can_coach: false };
    const after = { ...s, ...patch };
    // どの名簿にも残らず、ログインもしない人は「無効」にしておく（記録は残す）
    if (!canLogin(after) && !after.can_coach && !after.can_umpire) patch.is_active = false;
    setBusy(true);
    const r = await update(s.id, patch);
    setBusy(false);
    if (r) {
      apply([r]);
      setPerson(null);
      done(`${s.name}さんを${ROSTER_LABEL[kind]}から外しました`);
    }
  }

  async function savePerson(name: string, note: string) {
    if (!person) return;
    if (!name.trim()) {
      setFormError("名前を入力してください。");
      return;
    }
    setBusy(true);
    const r = await update(person.id, { name: name.trim(), note: note.trim() || null });
    setBusy(false);
    if (r) {
      apply([r]);
      setPerson(null);
      done("保存しました");
    }
  }

  // ---------- ログイン名簿 ----------
  function openLogin(s?: Staff) {
    setFormError(null);
    if (s) {
      const { id, ...rest } = s;
      setLogin({ id, form: { ...rest, email: rest.email ?? "", note: rest.note ?? "" } });
    } else {
      setLogin({
        id: null,
        form: { name: "", email: "", role: "staff", can_coach: false, can_umpire: false, can_plate: false, can_base: false, is_active: true, note: "" },
      });
    }
  }

  const otherAdmins = (id: string | null) => list.filter((s) => s.role === "admin" && s.is_active && canLogin(s) && s.id !== id).length;

  async function saveLogin() {
    if (!login) return;
    const form: StaffInput = {
      ...login.form,
      name: login.form.name.trim(),
      email: (login.form.email ?? "").trim().toLowerCase(),
      note: login.form.note?.trim() ? login.form.note.trim() : null,
      is_active: true,
    };
    const problem = validateStaff(form);
    if (problem) return setFormError(problem);
    const before = login.id ? list.find((s) => s.id === login.id) : undefined;
    if (before?.role === "admin" && form.role !== "admin" && otherAdmins(login.id) === 0) {
      return setFormError("管理者が1人もいなくなるため、この変更はできません。先に別の人を管理者にしてください。");
    }
    if (list.some((s) => s.email === form.email && s.id !== login.id)) {
      return setFormError("このメールアドレスはすでに登録されています。");
    }

    // 名前だけで審判名簿・指導者名簿にいる人なら、その人にメールアドレスを付ける
    const sameName = !login.id ? list.find((s) => s.name === form.name && !canLogin(s)) : undefined;
    setBusy(true);
    let saved: Staff | null = null;
    const basic: Patch = { name: form.name, email: form.email, role: form.role, note: form.note, is_active: true };
    if (login.id) {
      saved = await update(login.id, basic);
    } else if (sameName) {
      const newUmpire = form.can_umpire && !sameName.can_umpire;
      saved = await update(sameName.id, {
        ...basic,
        can_coach: sameName.can_coach || form.can_coach,
        can_umpire: sameName.can_umpire || form.can_umpire,
        ...(newUmpire ? { can_plate: true, can_base: true } : {}),
      });
    } else {
      const r = await insert([{ ...form, can_plate: form.can_umpire, can_base: form.can_umpire }]);
      saved = r?.[0] ?? null;
    }
    setBusy(false);
    if (saved) {
      apply([saved]);
      setLogin(null);
      done(`${saved.name}さんがログインできるようになりました`);
    }
  }

  async function removeLogin() {
    if (!login?.id) return;
    const s = list.find((x) => x.id === login.id);
    if (!s) return;
    if (s.role === "admin" && otherAdmins(s.id) === 0) {
      return setFormError("この人は最後の管理者なので、ログインを外せません。先に別の人を管理者にしてください。");
    }
    if (!window.confirm(`${s.name}さんをログインできないようにします。審判名簿・指導者名簿にはそのまま残ります。よろしいですか？`)) return;
    const patch: Patch = { email: null, role: "staff" };
    if (!s.can_coach && !s.can_umpire) patch.is_active = false;
    setBusy(true);
    const r = await update(s.id, patch);
    setBusy(false);
    if (r) {
      apply([r]);
      setLogin(null);
      done(`${s.name}さんのログインを外しました`);
    }
  }

  // ---------- 表示 ----------
  const rows = tab === "umpire" ? umpires : tab === "coach" ? coaches : logins;

  return (
    <>
      <div className="seg seg--3 roster-tabs" role="tablist" aria-label="名簿">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`seg__btn${tab === k ? " is-active" : ""}`}
            onClick={() => setTab(k)}
          >
            {ROSTER_LABEL[k].replace("名簿", "")}
            <span className="roster-tabs__num">{count[k]}</span>
          </button>
        ))}
      </div>

      <p className="roster-lead">
        {tab === "login"
          ? "ここに登録したGoogleアカウントだけが、このアプリにログインできます。"
          : `活動日の画面で、この名簿の人をタップして${tab === "umpire" ? "審判の枠に入れ" : "参加にし"}ます。ログインしない人も登録できます。`}
      </p>

      {isAdmin && tab !== "login" && (
        <div className="quick-add">
          <label className="field__label" htmlFor="quick-names">
            名前をまとめて追加
          </label>
          <textarea
            id="quick-names"
            className="input input--area"
            rows={3}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder={"1行に1人ずつ入力\n例）山本\n木村"}
          />
          <div className="quick-add__row">
            <span className="field__hint">
              {parseNames(quick).length > 0 ? `${parseNames(quick).length}人を追加します` : "ほかの名簿にいる人は、同じ人として追加されます"}
            </span>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || parseNames(quick).length === 0}
              onClick={() => quickAdd(tab)}
            >
              {ROSTER_LABEL[tab]}に追加
            </button>
          </div>
        </div>
      )}

      {isAdmin && tab === "login" && (
        <button type="button" className="btn btn--primary btn--block add-btn" onClick={() => openLogin()}>
          ＋ ログインできる人を追加
        </button>
      )}

      {rows.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{ROSTER_LABEL[tab]}にはまだ誰もいません</p>
          {isAdmin && <p className="muted">上の欄に名前を入力して追加してください。</p>}
        </div>
      ) : (
        <ul className="roster">
          {rows.map((s) => (
            <li key={s.id} className={`roster__row${s.is_active ? "" : " is-inactive"}`}>
              <button
                type="button"
                className="roster__main"
                disabled={!isAdmin}
                onClick={() => (tab === "login" ? openLogin(s) : (setFormError(null), setPerson(s)))}
              >
                <span className="roster__name">{s.name}</span>
                {tab === "login" ? (
                  <span className="roster__sub">
                    {s.email}
                    <span className={`role-tag role-tag--${s.role}`}>{ROLE_LABEL[s.role]}</span>
                  </span>
                ) : (
                  <span className="roster__sub">
                    {canLogin(s) && <span className="role-tag">ログイン可</span>}
                    {s.note}
                  </span>
                )}
              </button>
              {tab === "umpire" && (
                <span className="roster__checks">
                  {(["can_plate", "can_base"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`check-pill${s[k] ? " is-on" : ""}`}
                      aria-pressed={s[k]}
                      disabled={!isAdmin}
                      onClick={() => toggle(s, k)}
                    >
                      <span className="check-pill__box" aria-hidden="true">
                        {s[k] ? "✓" : ""}
                      </span>
                      {k === "can_plate" ? "球審" : "塁審"}
                    </button>
                  ))}
                </span>
              )}
              {tab === "login" && (
                <span className="roster__checks roster__checks--info">
                  {s.can_umpire && <span className="ability is-on">審判</span>}
                  {s.can_coach && <span className="ability is-on">指導者</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isAdmin && <p className="muted small-note">名簿の追加・変更は管理者だけができます。</p>}

      {person && (
        <PersonSheet
          person={person}
          kind={tab === "login" ? "coach" : tab}
          busy={busy}
          error={formError}
          onClose={() => setPerson(null)}
          onSave={savePerson}
          onRemove={(kind) => removeFrom(person, kind)}
        />
      )}

      {login && (
        <div className="sheet-backdrop" role="presentation" onClick={() => !busy && setLogin(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2 className="sheet__title">{login.id ? "ログインの設定" : "ログインできる人を追加"}</h2>
              <button type="button" className="sheet__close" onClick={() => setLogin(null)} aria-label="閉じる">
                ×
              </button>
            </div>
            <label className="field">
              <span className="field__label">名前</span>
              <input
                className="input"
                value={login.form.name}
                onChange={(e) => setLogin((l) => (l ? { ...l, form: { ...l.form, name: e.target.value } } : l))}
                placeholder="例：田中"
              />
              <span className="field__hint">審判名簿・指導者名簿にいる人と同じ名前なら、その人にログインを付けます。</span>
            </label>
            <label className="field">
              <span className="field__label">Googleのメールアドレス</span>
              <input
                className="input"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={login.form.email ?? ""}
                onChange={(e) => setLogin((l) => (l ? { ...l, form: { ...l.form, email: e.target.value } } : l))}
                placeholder="例：tanaka@gmail.com"
              />
            </label>
            <div className="field">
              <span className="field__label">できること</span>
              <div className="seg seg--3">
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`seg__btn${login.form.role === r ? " is-active" : ""}`}
                    onClick={() => setLogin((l) => (l ? { ...l, form: { ...l.form, role: r } } : l))}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <span className="field__hint">
                {login.form.role === "admin"
                  ? "すべての操作ができます（活動日の作成・名簿の編集など）"
                  : login.form.role === "staff"
                    ? "予定の確認と、グラウンド・指導者・審判の入力ができます"
                    : "予定を見ることだけができます"}
              </span>
            </div>
            {!login.id && (
              <div className="toggle-grid field">
                {(["can_umpire", "can_coach"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`toggle${login.form[k] ? " is-on" : ""}`}
                    aria-pressed={login.form[k]}
                    onClick={() => setLogin((l) => (l ? { ...l, form: { ...l.form, [k]: !l.form[k] } } : l))}
                  >
                    <span className="toggle__mark" aria-hidden="true">
                      {login.form[k] ? "✓" : ""}
                    </span>
                    {k === "can_umpire" ? "審判名簿にも入れる" : "指導者名簿にも入れる"}
                  </button>
                ))}
              </div>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            {login.id && (
              <button type="button" className="btn btn--danger btn--block" onClick={removeLogin} disabled={busy}>
                ログインできないようにする
              </button>
            )}
            <div className="sheet__actions">
              <button type="button" className="btn" onClick={() => setLogin(null)} disabled={busy}>
                やめる
              </button>
              <button type="button" className="btn btn--primary" onClick={saveLogin} disabled={busy}>
                {busy ? "保存しています…" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastEl}
    </>
  );
}

function PersonSheet({
  person,
  kind,
  busy,
  error,
  onClose,
  onSave,
  onRemove,
}: {
  person: Staff;
  kind: "umpire" | "coach";
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (name: string, note: string) => void;
  onRemove: (kind: "umpire" | "coach") => void;
}) {
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note ?? "");
  return (
    <div className="sheet-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2 className="sheet__title">{person.name}さん</h2>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <label className="field">
          <span className="field__label">名前</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">メモ</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：保護者、OB" />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn--danger btn--block" onClick={() => onRemove(kind)} disabled={busy}>
          {ROSTER_LABEL[kind]}から外す
        </button>
        <div className="sheet__actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            やめる
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onSave(name, note)} disabled={busy}>
            {busy ? "保存しています…" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
