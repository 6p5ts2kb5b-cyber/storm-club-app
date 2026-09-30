"use client";

// 活動日の詳細：12月〜4月は「トップ｜アカデミー」をタブで切り替えます
import { useEffect, useState } from "react";
import UmpireNeedPicker from "@/components/UmpireNeedPicker";
import UnitCard from "@/components/UnitCard";
import { DIVISION_LABEL } from "@/lib/divisions";
import type { UnitSummary } from "@/lib/status";

const SECTIONS = [
  { no: 1, title: "基本情報", step: "STEP4・5" },
  { no: 2, title: "試合情報", step: "STEP9" },
  { no: 3, title: "グラウンド", step: "STEP6" },
  { no: 4, title: "選手集合", step: "STEP7" },
  { no: 5, title: "指導者", step: "STEP8" },
  { no: 6, title: "審判の割り当て", step: "STEP10・12" },
  { no: 7, title: "審判集合", step: "STEP11" },
  { no: 8, title: "メモ", step: "STEP4" },
];

export default function DivisionTabs({ units: initialUnits }: { units: UnitSummary[] }) {
  const [units, setUnits] = useState<UnitSummary[]>(initialUnits);
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const unit = units[active];

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function changeNeed(required: boolean, needed: number) {
    setUnits((list) =>
      list.map((u, i) => (i === active ? { ...u, umpireRequired: required, umpireNeeded: needed } : u)),
    );
    // STEP4でクラウド保存に切り替えます。いまは画面の中だけの変更です
    setToast("保存しました（お試しモード）");
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
          <UmpireNeedPicker
            required={unit.umpireRequired}
            needed={unit.umpireNeeded}
            assigned={unit.umpireAssigned}
            onChange={changeNeed}
          />
        </div>
      )}

      <ol className="section-list">
        {SECTIONS.map((s) => (
          <li key={s.no} className="section-list__item">
            <span className="section-list__no">{s.no}</span>
            <span className="section-list__title">{s.title}</span>
            <span className="section-list__step">{s.step}で入力可能に</span>
          </li>
        ))}
      </ol>

      {toast && (
        <div className="toast toast--ok" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
