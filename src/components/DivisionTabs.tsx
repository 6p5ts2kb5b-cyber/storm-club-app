"use client";

// 活動日の詳細：12月〜4月は「トップ｜アカデミー」をタブで切り替えます
// 上から「状況カード → グラウンド → 選手集合 → 指導者 → 審判」の順に並べます。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CoachPanel from "@/components/CoachPanel";
import GamePanel from "@/components/GamePanel";
import GroundPanel from "@/components/GroundPanel";
import PlayerGatherPanel from "@/components/PlayerGatherPanel";
import UmpireSection from "@/components/UmpireSection";
import UnitCard from "@/components/UnitCard";
import { useToast } from "@/components/useToast";
import { savePlayerGather, setCoach } from "@/lib/activity-actions";
import type { StaffOption } from "@/lib/data";
import { DIVISION_LABEL } from "@/lib/divisions";
import { deriveGround, type Ground } from "@/lib/grounds";
import type { Game, UnitSummary } from "@/lib/status";
import { deriveUmpire } from "@/lib/umpire";

const SECTIONS = [
  { no: 1, title: "基本情報", note: "右上の「編集」から変更" },
  { no: 2, title: "試合情報", note: "上で入力" },
  { no: 3, title: "グラウンド", note: "上で入力" },
  { no: 4, title: "選手集合", note: "上で入力" },
  { no: 5, title: "指導者", note: "上で入力" },
  { no: 6, title: "審判", note: "上で入力（必要人数・試合ごとの枠）" },
  { no: 7, title: "審判集合", note: "上で入力（自動計算＋手動修正）" },
  { no: 8, title: "メモ", note: "右上の「編集」から変更" },
];

export default function DivisionTabs({
  units: initialUnits,
  staff,
  isAdmin,
  canEdit,
  demo,
}: {
  units: UnitSummary[];
  /** 指導者・審判の選択肢（スタッフマスター） */
  staff: StaffOption[];
  isAdmin: boolean;
  /** グラウンド・指導者・審判を入力できるか（管理者・スタッフ） */
  canEdit: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitSummary[]>(initialUnits);
  const [active, setActive] = useState(0);
  const [coachBusy, setCoachBusy] = useState<string | null>(null);
  const [toastEl, showToast] = useToast();
  const unit = units[active];

  // 保存後にサーバーから届いた最新の内容で置き換える
  useEffect(() => setUnits(initialUnits), [initialUnits]);

  /** いま表示している区分の内容だけを書き換える（審判の集計も計算し直す） */
  function patchActive(patch: Partial<UnitSummary>) {
    setUnits((list) =>
      list.map((u, i) => {
        if (i !== active) return u;
        const next = { ...u, ...patch };
        return { ...next, ...deriveUmpire(next) };
      }),
    );
  }

  function changeGames(next: Game[]) {
    const ids = new Set(next.map((g) => g.id));
    patchActive({
      games: [...next].sort((a, b) => a.no - b.no),
      // 削除された試合の審判の枠も外す
      umpireSlots: (unit?.umpireSlots ?? []).filter((s) => ids.has(s.gameId)),
    });
    if (!demo) router.refresh();
  }

  function changeGrounds(next: Ground[]) {
    patchActive({ grounds: next, ...deriveGround(next) });
    if (!demo) router.refresh(); // 会場の自動入力などを反映
  }

  async function changeGather(time: string | null, place: string | null): Promise<boolean> {
    if (!unit) return false;
    if (demo || !unit.id) {
      patchActive({ playerGatherTime: time ?? undefined, gatherPlace: place ?? undefined });
      showToast("ok", "保存しました（お試しモード）");
      return true;
    }
    const result = await savePlayerGather(unit.id, time, place);
    if (!result.ok) {
      showToast("ng", result.message);
      return false;
    }
    patchActive({ playerGatherTime: time ?? undefined, gatherPlace: place ?? undefined });
    showToast("ok", "保存しました");
    router.refresh();
    return true;
  }

  async function toggleCoach(staffId: string, join: boolean) {
    if (!unit) return;
    const beforeIds = unit.coachIds ?? [];
    const nextIds = join ? [...beforeIds, staffId] : beforeIds.filter((id) => id !== staffId);
    const names = staff.filter((s) => nextIds.includes(s.id)).map((s) => s.name);
    // 先に画面を切り替えて、すぐ反応しているように見せる
    patchActive({ coachIds: nextIds, coaches: names });

    const who = staff.find((s) => s.id === staffId)?.name ?? "";
    if (demo || !unit.id) {
      showToast("ok", `${who}さんを${join ? "参加" : "取り消し"}にしました（お試しモード）`);
      return;
    }
    setCoachBusy(staffId);
    const result = await setCoach(unit.id, staffId, join);
    setCoachBusy(null);
    if (result.ok) {
      showToast("ok", `${who}さんを${join ? "参加" : "取り消し"}にしました`);
      router.refresh();
    } else {
      patchActive({ coachIds: beforeIds, coaches: staff.filter((s) => beforeIds.includes(s.id)).map((s) => s.name) });
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
          <GamePanel
            key={`games-${unit.division}`}
            unitId={unit.id}
            games={unit.games}
            canEdit={isAdmin}
            demo={demo}
            onChange={changeGames}
            notify={showToast}
          />
        </div>
      )}

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
          <PlayerGatherPanel
            key={`gather-${unit.division}`}
            time={unit.playerGatherTime}
            place={unit.gatherPlace}
            canEdit={isAdmin}
            onSave={changeGather}
          />
        </div>
      )}

      {unit && (
        <div className="detail-block">
          <CoachPanel
            staff={staff}
            selectedIds={unit.coachIds ?? []}
            canEdit={canEdit}
            busyId={coachBusy}
            onToggle={toggleCoach}
          />
        </div>
      )}

      {unit && (
        <div className="detail-block">
          <UmpireSection
            key={`ump-${unit.division}`}
            unit={unit}
            staff={staff}
            isAdmin={isAdmin}
            canEdit={canEdit}
            demo={demo}
            onPatch={patchActive}
            notify={showToast}
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
