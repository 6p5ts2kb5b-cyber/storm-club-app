"use client";

// 活動日の詳細：12月〜4月は「トップ｜アカデミー」をタブで切り替えます
// 上から「状況カード → グラウンド → 選手集合 → 指導者 → 審判」の順に並べます。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CoachPanel from "@/components/CoachPanel";
import GamePanel from "@/components/GamePanel";
import LineShare from "@/components/LineShare";
import GroundPanel from "@/components/GroundPanel";
import PlayerGatherPanel from "@/components/PlayerGatherPanel";
import UmpireSection from "@/components/UmpireSection";
import UnitCard from "@/components/UnitCard";
import { useToast } from "@/components/useToast";
import { savePlayerGather, setCoach } from "@/lib/activity-actions";
import type { StaffOption } from "@/lib/data";
import { DIVISION_LABEL } from "@/lib/divisions";
import { deriveGround, type Ground } from "@/lib/grounds";
import Lamp from "@/components/Lamp";
import TournamentPanel from "@/components/TournamentPanel";
import { checkUnit, type Game, isRest, type Level, type TournamentState, type UnitSummary, worstLevel } from "@/lib/status";
import { saveTournament } from "@/lib/activity-actions";
import { deriveUmpire } from "@/lib/umpire";

/** 各欄の状態（ジャンプ用のバーに出すランプ） */
function sectionLevels(u: UnitSummary): { id: string; label: string; level: Level }[] {
  const items = checkUnit(u);
  const lv = (key: string): Level => items.find((i) => i.key === key)?.level ?? "none";
  const worst = (...ls: Level[]): Level =>
    ls.includes("ng") ? "ng" : ls.includes("warn") ? "warn" : ls.every((l) => l === "none") ? "none" : "ok";
  const games: Level = u.games.length === 0 ? "none" : u.games.some((g) => !g.start) ? "ng" : "ok";
  const umpire: Level = u.umpireRequired
    ? worst(lv("umpire"), lv("umpireGather"), u.openPositions.length ? "ng" : "ok")
    : "none";
  return [
    { id: "sec-games", label: "試合", level: games },
    { id: "sec-ground", label: "グラウンド", level: lv("ground") },
    { id: "sec-gather", label: "選手集合", level: lv("player") },
    { id: "sec-coach", label: "指導者", level: lv("coach") },
    { id: "sec-umpire", label: "審判", level: umpire },
  ];
}

export default function DivisionTabs({
  date,
  units: initialUnits,
  staff,
  isAdmin,
  canEdit,
  demo,
}: {
  /** この活動日 "2026-10-11" */
  date: string;
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
  const rest = unit ? isRest(unit) : false; // 大会が実施されて「休み」の日

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

  async function changeTournament(name: string | null, state: TournamentState): Promise<boolean> {
    if (!unit) return false;
    const patch = { tournamentName: name ?? undefined, tournamentState: name ? state : undefined };
    if (demo || !unit.id) {
      patchActive(patch);
      showToast("ok", "保存しました（お試しモード）");
      return true;
    }
    const result = await saveTournament(unit.id, name, state);
    if (!result.ok) {
      showToast("ng", result.message);
      return false;
    }
    patchActive(patch);
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
              <Lamp level={worstLevel(u)} />
              {DIVISION_LABEL[u.division]}
            </button>
          ))}
        </div>
      )}

      {unit && !rest && (
        <nav className="jumpbar" aria-label="この日の入力欄へ移動">
          {sectionLevels(unit).map((sec) => (
            <a key={sec.id} href={`#${sec.id}`} className={`jump jump--${sec.level}`}>
              <Lamp level={sec.level} />
              {sec.label}
            </a>
          ))}
        </nav>
      )}

      {unit && (
        <div className="detail-board">
          <UnitCard unit={unit} />
        </div>
      )}

      {unit && (
        <div className="detail-block" id="sec-event">
          <TournamentPanel
            key={`event-${unit.division}`}
            name={unit.tournamentName}
            state={unit.tournamentState}
            isAdmin={isAdmin}
            onSave={changeTournament}
          />
        </div>
      )}

      {unit && !rest && (
        <div className="detail-block" id="sec-games">
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

      {unit && !rest && (
        <div className="detail-block" id="sec-ground">
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

      {unit && !rest && (
        <div className="detail-block" id="sec-gather">
          <PlayerGatherPanel
            key={`gather-${unit.division}`}
            time={unit.playerGatherTime}
            place={unit.gatherPlace}
            canEdit={isAdmin}
            onSave={changeGather}
          />
        </div>
      )}

      {unit && !rest && (
        <div className="detail-block" id="sec-coach">
          <CoachPanel
            staff={staff}
            selectedIds={unit.coachIds ?? []}
            canEdit={canEdit}
            busyId={coachBusy}
            onToggle={toggleCoach}
          />
        </div>
      )}

      {unit && !rest && (
        <div className="detail-block" id="sec-umpire">
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

      {unit && (
        <div className="detail-block" id="sec-line">
          <LineShare key={`line-${unit.division}`} date={date} unit={unit} />
        </div>
      )}

      {toastEl}
    </div>
  );
}
