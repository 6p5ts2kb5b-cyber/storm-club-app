"use client";

// 指導者：スタッフマスターから、名前の大きなボタンをタップして参加／取り消し
import type { StaffOption } from "@/lib/data";

export default function CoachPanel({
  staff,
  selectedIds,
  canEdit,
  busyId,
  onToggle,
}: {
  staff: StaffOption[];
  selectedIds: string[];
  canEdit: boolean;
  /** 保存中の人（二重押し防止） */
  busyId: string | null;
  onToggle: (staffId: string, join: boolean) => void;
}) {
  // 選択肢：有効で「指導者として参加可能」な人 ＋ すでに参加になっている人
  const options = staff.filter((s) => (s.is_active && s.can_coach) || selectedIds.includes(s.id));
  const count = selectedIds.length;
  const selectedNames = staff.filter((s) => selectedIds.includes(s.id)).map((s) => s.name);

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">指導者</h2>
        <span className={`count-badge${count === 0 ? " count-badge--ng" : " count-badge--ok"}`}>参加 {count}名</span>
      </div>

      {count > 0 ? (
        <p className="coach-names">{selectedNames.join("・")}</p>
      ) : (
        <p className="coach-names coach-names--ng">🔴 まだ誰も決まっていません</p>
      )}

      {options.length === 0 ? (
        <p className="muted">
          指導者として登録されたスタッフがいません。「スタッフ」画面で「指導者」をオンにしてください。
        </p>
      ) : (
        <div className="name-grid">
          {options.map((s) => {
            const on = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`name-btn${on ? " is-on" : ""}`}
                aria-pressed={on}
                disabled={!canEdit || busyId === s.id}
                onClick={() => onToggle(s.id, !on)}
              >
                <span className="name-btn__mark" aria-hidden="true">
                  {on ? "✓" : ""}
                </span>
                <span className="name-btn__name">{s.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {canEdit && options.length > 0 && <p className="field__hint">名前をタップすると、すぐに保存されます</p>}
    </section>
  );
}
