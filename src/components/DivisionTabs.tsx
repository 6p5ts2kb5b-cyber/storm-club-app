"use client";

// 活動日の詳細：12月〜4月は「トップ｜アカデミー」をタブで切り替えます
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GroundPanel from "@/components/GroundPanel";
import UmpireNeedPicker from "@/components/UmpireNeedPicker";
import UnitCard from "@/components/UnitCard";
import { useToast } from "@/components/useToast";
import { saveUmpireNeed } from "@/lib/activity-actions";
import { DIVISION_LABEL } from "@/lib/divisions";
import { deriveGround, type Ground } from "@/lib/grounds";
import type { UnitSummary } from "@/lib/status";

const SECTIONS = [
  { no: 1, title: "基本情報", note: "右上の「編集」から変更" },
  { no: 2, title: "試合情報", note: "STEP9で入力可能に" },
  { no: 3, title: "グラウンド", note: "上の「グラウンド」で入力" },
  { no: 4, title: "選手集合", note: "STEP7で入力可能に" },
  { no: 5, title: "指導者", note: "STEP8で入力可能に" },
  { no: 6, title: "審判の割り当て", note: "STEP10・12で入力可能に" },
  { no: 7, title: "審判集合", note: "STEP11で入力可能に" },
  { no: 8, title: "メモ", note: "右上の「編集」から変更" },
];

export default function DivisionTabs({
  units: initialUnits,
  isAdmin,
  canEdit,
  demo,
}: {
  units: UnitSummary[];
  isAdmin: boolean;
  /** グラウンド・指導者・審判を入力できるか（管理者・スタッフ） */
  canEdit: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitSummary[]>(initialUnits);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toastEl, showToast] = useToast();
  const unit = units[active];

  // 保存後にサーバーから届いた最新の内容で置き換える
  useEffect(() => setUnits(initialUnits), [initialUnits]);

  function changeGrounds(next: Ground[]) {
    setUnits((list) => list.map((u, i) => (i === active ? { ...u, grounds: next, ...deriveGround(next) } : u)));
    if (!demo) router.refresh(); // 会場の自動入力などを反映
  }

  async function changeNeed(required: boolean, needed: number) {
    if (!unit) return;
    const before = units;
    // 先に画面を切り替えて、すぐ反応しているように見せる
    setUnits((list) =>
      list.map((u, i) => (i === active ? { ...u, umpireRequired: required, umpireNeeded: needed } : u)),
    );

    if (demo || !unit.id) {
      showToast("ok", "保存しました（お試しモード）");
      return;
    }
    setSaving(true);
    const result = await saveUmpireNeed(unit.id, required, needed);
    setSaving(false);
    if (result.ok) {
      showToast("ok", "保存しました");
      router.refresh();
    } else {
      setUnits(before); // 保存できなかったら元に戻す
      showToast("ng", result.message);
    }
  }

  return (
    <div>
      {units.length > 1 && (
        <div className="seg" role="tablist" aria-label="活動区分">
          {units.map((u, i) => (
            <button
              key={u.division}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`seg__btn seg__btn--${u.division}${i === active ? " is-active" : ""}`}
              onClick={() => setActive(i)}
            >
              {DIVISION_LABEL[u.division]}
            </button>
          ))}
        </div>
      )}

      {unit && <UnitCard unit={unit} />}

      {unit && (
        <div className="detail-block">
          <GroundPanel
            key={unit.division}
            unitId={unit.id}
            grounds={unit.grounds ?? []}
            canEdit={canEdit}
            demo={demo}
            onChange={changeGrounds}
            notify={showToast}
          />
        </div>
      )}

      {unit && (
        <div className="detail-block">
          <UmpireNeedPicker
            required={unit.umpireRequired}
            needed={unit.umpireNeeded}
            assigned={unit.umpireAssigned}
            disabled={!isAdmin || saving}
            onChange={changeNeed}
          />
        </div>
      )}

      <ol className="section-list">
        {SECTIONS.map((s) => (
          <li key={s.no} className="section-list__item">
            <span className="section-list__no">{s.no}</span>
            <span className="section-list__title">{s.title}</span>
            <span className="section-list__step">{s.note}</span>
          </li>
        ))}
      </ol>

      {toastEl}
    </div>
  );
}
