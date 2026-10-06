"use client";

// 写真・PDF・音声から予定を読み取る
//   1. 選ぶ    … 写真を撮る／ファイルを選ぶ（写真・PDF・音声）／文章を貼り付け
//   2. 読み取る … Gemini が日時・集合時間・審判の人数などを読み取る
//   3. 直す    … 下書きを手で直す（読み取りは間違えることがあるので、必ず確認）
//   4. 登録    … チェックした日だけ登録。登録済みの日は空いている項目だけ埋める
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import BigDate from "@/components/BigDate";
import { useToast } from "@/components/useToast";
import { autoModeForDate, DIVISION_LABEL, type Division } from "@/lib/divisions";
import { ACTIVITY_CHOICES, type DraftUnit } from "@/lib/extract";
import { groupDrafts, saveImport } from "@/lib/import-actions";
import { MAX_UMPIRES, type DaySummary } from "@/lib/status";

type Picked = { id: string; file: File; kind: "image" | "pdf" | "audio" };

const MAX_TOTAL = 4_200_000;

function kindOf(f: File): Picked["kind"] | null {
  const n = f.name.toLowerCase();
  if (f.type.startsWith("image/")) return "image";
  if (f.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (f.type.startsWith("audio/") || /\.(m4a|mp3|wav|aac|ogg|flac|webm|opus)$/.test(n)) return "audio";
  return null;
}

/** 写真は長い辺を2000pxに縮めて、軽いJPEGにする（文字は読める大きさのまま） */
async function shrinkImage(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const mb = (n: number) => `${(n / 1_000_000).toFixed(1)}MB`;

export default function ImportFlow({ existing, demo }: { existing: DaySummary[]; demo: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [memo, setMemo] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftUnit[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [toastEl, showToast] = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const total = picked.reduce((n, p) => n + p.file.size, 0);
  const existingDates = new Set(existing.map((d) => d.date));

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: Picked[] = [];
    for (const f of Array.from(list)) {
      const kind = kindOf(f);
      if (!kind) {
        setError(`「${f.name}」は読み取れない種類です。写真・PDF・音声を選んでください。`);
        continue;
      }
      const file = kind === "image" ? await shrinkImage(f) : f;
      next.push({ id: `${Date.now()}-${f.name}-${Math.random()}`, file, kind });
    }
    setPicked((p) => [...p, ...next]);
  }

  async function read() {
    setError(null);
    if (total > MAX_TOTAL) {
      setError(`ファイルの合計が ${mb(total)} あります。約4MBまでにしてください（音声は短く区切ると読み取れます）。`);
      return;
    }
    const body = new FormData();
    picked.forEach((p) => body.append("files", p.file));
    if (memo.trim()) body.append("text", memo.trim());
    setReading(true);
    try {
      const res = await fetch("/api/extract", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.message ?? "読み取りに失敗しました。もう一度お試しください。");
        return;
      }
      const list = json.drafts as DraftUnit[];
      setDrafts(list);
      setWarnings(json.warnings ?? []);
      // 新しい日は登録する、登録済みの日は最初はチェックを外しておく
      setInclude(Object.fromEntries(groupDrafts(list).map((g) => [g.date, !existingDates.has(g.date)])));
      if (list.length === 0) setError("予定を見つけられませんでした。日付が写るように撮り直すか、文章で貼り付けてください。");
    } catch {
      setError("インターネットにつながっていません。電波の良い場所でもう一度お試しください。");
    } finally {
      setReading(false);
    }
  }

  function patch(key: string, p: Partial<DraftUnit>) {
    setDrafts((list) => list?.map((d) => (d.key === key ? { ...d, ...p } : d)) ?? null);
  }

  function changeDate(oldDate: string, newDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    setDrafts((list) => list?.map((d) => (d.date === oldDate ? { ...d, date: newDate } : d)) ?? null);
    setInclude((m) => {
      const { [oldDate]: was, ...rest } = m;
      return { ...rest, [newDate]: was ?? true };
    });
  }

  async function register() {
    if (!drafts) return;
    const chosen = drafts.filter((d) => include[d.date]);
    if (chosen.length === 0) return;
    if (demo) {
      showToast("ok", `${groupDrafts(chosen).length}日分を登録しました（お試しモード）`);
      return;
    }
    setSaving(true);
    const r = await saveImport(chosen, existing);
    setSaving(false);
    if (r.errors.length) {
      setError(r.errors.join("\n"));
      if (r.created + r.filled === 0) return;
    }
    const parts = [r.created && `${r.created}日分を登録`, r.filled && `${r.filled}日分の空欄を埋め`].filter(Boolean).join("、");
    setWarnings(r.skipped);
    setDoneMsg(`${parts || "登録"}ました`);
    setDrafts(null);
    setPicked([]);
    setMemo("");
    router.refresh();
  }

  // ---------------- 登録が終わったら ----------------
  if (doneMsg) {
    return (
      <section className="panel import-done">
        <p className="import-done__title">
          <span className="lamp lamp--ok" aria-hidden="true" />
          {doneMsg}
        </p>
        {warnings.length > 0 && (
          <ul className="import-warn">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="import-done__actions">
          <button type="button" className="btn" onClick={() => (setDoneMsg(null), setWarnings([]), setError(null))}>
            続けて読み取る
          </button>
          <button type="button" className="btn btn--primary" onClick={() => router.push("/activities")}>
            活動一覧を見る
          </button>
        </div>
      </section>
    );
  }

  // ---------------- 1. 選ぶ ----------------
  if (!drafts) {
    return (
      <>
        <section className="panel import-pick">
          <div className="import-buttons">
            <button type="button" className="import-btn" onClick={() => cameraRef.current?.click()} disabled={reading}>
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              写真を撮る
            </button>
            <button type="button" className="import-btn" onClick={() => fileRef.current?.click()} disabled={reading}>
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M6 3h8l4 4v14H6z" />
                <path d="M14 3v4h4M9 13h6M9 17h6" />
              </svg>
              ファイルを選ぶ
              <span className="import-btn__sub">写真・PDF・音声</span>
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,audio/*,.m4a,.mp3,.wav,.aac"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {picked.length > 0 && (
            <ul className="picked">
              {picked.map((p) => (
                <li key={p.id} className="picked__item">
                  <span className={`picked__kind picked__kind--${p.kind}`}>{p.kind === "image" ? "写真" : p.kind === "pdf" ? "PDF" : "音声"}</span>
                  <span className="picked__name">{p.file.name}</span>
                  <span className="picked__size">{mb(p.file.size)}</span>
                  <button
                    type="button"
                    className="picked__remove"
                    aria-label={`${p.file.name}を外す`}
                    onClick={() => setPicked((l) => l.filter((x) => x.id !== p.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="field import-memo">
            <span className="field__label">文章を貼り付ける（LINEの連絡など）</span>
            <textarea
              className="input input--area"
              rows={4}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={"例）12/5(土) トップ 坂戸中 7:30集合\n第1試合 9:00 vs 川越ベアーズ\n審判4名お願いします"}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="btn btn--primary btn--block import-go"
            onClick={read}
            disabled={reading || (picked.length === 0 && !memo.trim())}
          >
            {reading ? "読み取っています…（10〜30秒）" : "読み取る"}
          </button>
          <p className="field__hint center">
            写真は自動で軽くしてから送ります。合計は約4MBまで（音声なら数分程度）。
          </p>
        </section>
        {toastEl}
      </>
    );
  }

  // ---------------- 2. 確認して直す ----------------
  const groups = groupDrafts(drafts);
  const chosenDays = groups.filter((g) => include[g.date]).length;

  return (
    <>
      <div className="import-head">
        <p className="import-head__lead">
          <strong>{groups.length}日分</strong>の予定を読み取りました。読み取りは間違えることがあるので、内容を確認して直してから登録してください。
        </p>
        <button type="button" className="btn" onClick={() => setDrafts(null)}>
          やり直す
        </button>
      </div>

      {warnings.length > 0 && (
        <ul className="import-warn">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="drafts">
        {groups.map((g) => {
          const exists = existingDates.has(g.date);
          const on = include[g.date] ?? false;
          return (
            <section key={g.date} className={`draft${on ? "" : " is-off"}`}>
              <header className="draft__head">
                <button
                  type="button"
                  className={`draft__check${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  aria-label={on ? "登録する" : "登録しない"}
                  onClick={() => setInclude((m) => ({ ...m, [g.date]: !on }))}
                >
                  {on ? "✓" : ""}
                </button>
                <BigDate date={g.date} size="lg" />
                <label className="draft__date">
                  <span className="sr-only">日付を直す</span>
                  <input type="date" className="input" value={g.date} onChange={(e) => changeDate(g.date, e.target.value)} />
                </label>
              </header>
              {exists && <p className="draft__exists">登録済みの日です。チェックすると、空いている項目だけを埋めます。</p>}

              {g.units.map((u) => (
                <div key={u.key} className="draft-unit">
                  <div className="seg seg--3 draft-unit__div">
                    {(["storm", "top", "academy"] as Division[]).map((dv) => (
                      <button
                        key={dv}
                        type="button"
                        className={`seg__btn seg__btn--${dv}${u.division === dv ? " is-active" : ""}`}
                        onClick={() => patch(u.key, { division: dv })}
                      >
                        {dv === "storm" ? "STORM" : DIVISION_LABEL[dv]}
                      </button>
                    ))}
                  </div>
                  {autoModeForDate(u.date) === "split" && u.division === "storm" && (
                    <p className="field__hint">12月〜4月ですが、STORMクラブ1つで登録します。</p>
                  )}

                  {u.unsure && <p className="draft-unit__unsure">読み取りが不確かな点：{u.unsure}</p>}

                  <div className="draft-grid">
                    <label className="field">
                      <span className="field__label">活動内容</span>
                      <select className="input" value={u.activityType} onChange={(e) => patch(u.key, { activityType: e.target.value })}>
                        {ACTIVITY_CHOICES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field__label">会場</span>
                      <input className="input" value={u.venue} onChange={(e) => patch(u.key, { venue: e.target.value })} placeholder="未定" />
                    </label>
                    <label className="field">
                      <span className="field__label">選手集合</span>
                      <input className="input input--time" type="time" value={u.playerGather} onChange={(e) => patch(u.key, { playerGather: e.target.value })} />
                    </label>
                    <label className="field">
                      <span className="field__label">審判の人数</span>
                      <select
                        className="input"
                        value={u.umpireNeeded}
                        onChange={(e) => patch(u.key, { umpireNeeded: Number(e.target.value) })}
                      >
                        <option value={0}>不要</option>
                        {Array.from({ length: MAX_UMPIRES }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}名
                          </option>
                        ))}
                      </select>
                    </label>
                    {u.umpireNeeded > 0 && (
                      <label className="field">
                        <span className="field__label">審判集合</span>
                        <input className="input input--time" type="time" value={u.umpireGather} onChange={(e) => patch(u.key, { umpireGather: e.target.value })} />
                        {!u.umpireGather && <span className="field__hint">空なら第1試合の60分前で自動計算</span>}
                      </label>
                    )}
                  </div>

                  <div className="draft-games">
                    <span className="field__label">試合</span>
                    {u.games.map((gm, i) => (
                      <div key={i} className="draft-game">
                        <span className="draft-game__no">第{i + 1}試合</span>
                        <input
                          className="input input--time"
                          type="time"
                          value={gm.start}
                          aria-label={`第${i + 1}試合の開始時間`}
                          onChange={(e) => patch(u.key, { games: u.games.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })}
                        />
                        <input
                          className="input"
                          value={gm.opponent}
                          placeholder="対戦相手"
                          aria-label={`第${i + 1}試合の対戦相手`}
                          onChange={(e) => patch(u.key, { games: u.games.map((x, j) => (j === i ? { ...x, opponent: e.target.value } : x)) })}
                        />
                        <button
                          type="button"
                          className="picked__remove"
                          aria-label={`第${i + 1}試合を消す`}
                          onClick={() => patch(u.key, { games: u.games.filter((_, j) => j !== i) })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {u.games.length < 10 && (
                      <button
                        type="button"
                        className="btn btn--outline btn--block"
                        onClick={() => patch(u.key, { games: [...u.games, { start: "", opponent: "" }] })}
                      >
                        ＋ 試合を追加
                      </button>
                    )}
                  </div>

                  <label className="field">
                    <span className="field__label">メモ</span>
                    <input className="input" value={u.note} onChange={(e) => patch(u.key, { note: e.target.value })} />
                  </label>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      {error && (
        <p className="form-error import-error" role="alert">
          {error}
        </p>
      )}

      <div className="import-bar">
        <button type="button" className="btn btn--primary btn--block" onClick={register} disabled={saving || chosenDays === 0}>
          {saving ? "登録しています…" : chosenDays ? `チェックした ${chosenDays}日分を登録する` : "登録する日にチェックを入れてください"}
        </button>
      </div>
      {toastEl}
    </>
  );
}
