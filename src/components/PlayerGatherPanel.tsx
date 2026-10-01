"use client";

// 選手集合時間・集合場所
// iPhoneで操作しやすいよう、よく使う時刻はボタン1回、細かい調整は「−15分／＋15分」、
// それ以外はiPhone標準の時刻ホイールで選べます。
import { useEffect, useState } from "react";
import TimeField from "@/components/TimeField";

const PRESETS = ["06:30", "07:00", "07:30", "08:00", "08:30", "09:00"];
const PLACES = ["現地集合", "学校集合", "駅集合"];

export default function PlayerGatherPanel({
  time,
  place,
  canEdit,
  onSave,
}: {
  time?: string;
  place?: string;
  canEdit: boolean;
  onSave: (time: string | null, place: string | null) => Promise<boolean>;
}) {
  const [t, setT] = useState(time ?? "");
  const [p, setP] = useState(place ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setT(time ?? "");
    setP(place ?? "");
  }, [time, place]);

  const changed = t !== (time ?? "") || p !== (place ?? "");
  const customPlace = p !== "" && !PLACES.includes(p);

  async function save() {
    setBusy(true);
    await onSave(t || null, p || null);
    setBusy(false);
  }

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">選手集合</h2>
        {!time && <span className="count-badge count-badge--ng">未設定</span>}
      </div>

      <TimeField value={t} onChange={setT} label="選手の集合時間" presets={PRESETS} disabled={!canEdit} />

      <div className="field gather-place">
        <span className="field__label">集合場所</span>
        {canEdit ? (
          <>
            <div className="chip-grid">
              {PLACES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`chip-btn${p === v ? " is-active" : ""}`}
                  aria-pressed={p === v}
                  onClick={() => setP(p === v ? "" : v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <input
              className="input"
              value={customPlace ? p : ""}
              onChange={(e) => setP(e.target.value)}
              placeholder="その他（例：坂戸駅 北口）"
            />
          </>
        ) : (
          <p className="gather-place__text">{p || <span className="muted">未設定</span>}</p>
        )}
      </div>

      {canEdit && (
        <div className="panel__actions">
          {t && (
            <button type="button" className="btn" onClick={() => setT("")} disabled={busy}>
              時刻を消す
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={save} disabled={!changed || busy}>
            {busy ? "保存しています…" : changed ? "保存する" : t || p ? "保存済み" : "時刻を選んでください"}
          </button>
        </div>
      )}
    </section>
  );
}
