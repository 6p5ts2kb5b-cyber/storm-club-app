// ============================================================
// お試しモード用のサンプルデータ（画面の見た目・操作を確認するためだけのもの）
// Supabase（クラウドのデータベース）の設定が終わると、本物のデータに切り替わります。
// ============================================================

import { deriveGround, type Ground, type GroundStatus, type SchoolUse, type StormUse } from "./grounds";
import { SAMPLE_STAFF } from "./staff";
import type { DaySummary, Game, UnitSummary } from "./status";
import { deriveUmpire, type Position, type Slot, type UmpirePerson } from "./umpire";

/** 名前 → サンプルのスタッフ番号 */
function sid(name: string): string {
  return SAMPLE_STAFF.find((s) => s.name === name)?.id ?? name;
}

/** 名前からサンプルのスタッフ番号を引いて、指導者の情報を作る */
function coaches(...names: string[]) {
  return { coaches: names, coachIds: names.map(sid) };
}

let seq = 0;
function g(school: string, status: GroundStatus, school_use: SchoolUse, storm_use: StormUse, note: string | null = null): Ground {
  seq += 1;
  return { id: `sample-g${seq}`, school_name: school, ground_name: null, school_use, storm_use, status, note };
}

/** 審判の枠：名前を書けばスタッフ、"相手" なら相手チーム */
function slot(gameId: string, position: Position, who: string): Slot {
  seq += 1;
  return who === "相手"
    ? { id: `sample-s${seq}`, gameId, position, opponent: true }
    : { id: `sample-s${seq}`, gameId, position, opponent: false, staffId: sid(who), staffName: who };
}

/** 審判の集計（決定人数・空き枠・集合時間）を付けて完成させる */
function unit(u: Omit<UnitSummary, "umpireAssigned" | "openPositions" | "umpireGatherTime" | "umpireGatherAuto">): UnitSummary {
  return { ...u, ...deriveUmpire(u) };
}

const G_1003 = [g("坂戸中学校", "decided", "none", "ok"), g("住吉中学校", "unavailable", "planned", "ng", "学校の部活で使用")];
const G_1010 = [
  g("坂戸中学校", "checking", "unknown", "unknown", "教頭先生に確認中"),
  g("住吉中学校", "candidate", "unknown", "unknown"),
  g("北中学校", "candidate", "unknown", "unknown"),
];
const G_1205_TOP = [g("坂戸中学校", "decided", "none", "ok")];
const G_1205_ACA = [g("住吉中学校", "checking", "none", "unknown"), g("三芳中学校", "candidate", "unknown", "unknown")];

// ---- 10/3（STORM）：第1試合は4人制で二塁審が空き、第2試合は2人制で塁審が空き ----
const GAMES_1003: Game[] = [
  { id: "sample-game1", no: 1, start: "09:00", opponent: "川越ベアーズ", system: 4 },
  { id: "sample-game2", no: 2, start: "11:00", opponent: "鶴ヶ島ファイターズ", system: 2 },
];
const SLOTS_1003 = [
  slot("sample-game1", "plate", "田中"),
  slot("sample-game1", "first", "佐藤"),
  slot("sample-game1", "third", "相手"),
  slot("sample-game2", "plate", "鈴木"),
];

// ---- 12/5 トップ：3試合・4人制。鈴木さんは第3試合だけ、45分前集合 → 12:15 ----
const GAMES_1205_TOP: Game[] = [
  { id: "sample-game3", no: 1, start: "09:00", system: 4 },
  { id: "sample-game4", no: 2, start: "11:00", system: 4 },
  { id: "sample-game5", no: 3, start: "13:00", system: 4, note: "時間は相手チームに確認中" },
];
const SLOTS_1205_TOP = [
  slot("sample-game3", "plate", "田中"),
  slot("sample-game3", "first", "佐藤"),
  slot("sample-game3", "second", "相手"),
  slot("sample-game3", "third", "相手"),
  slot("sample-game4", "plate", "玉城"),
  slot("sample-game4", "first", "田中"),
  slot("sample-game4", "second", "相手"),
  slot("sample-game4", "third", "相手"),
  slot("sample-game5", "plate", "鈴木"),
  slot("sample-game5", "first", "相手"),
  slot("sample-game5", "second", "相手"),
  slot("sample-game5", "third", "相手"),
];
const PEOPLE_1205_TOP: UmpirePerson[] = [{ staffId: sid("鈴木"), offsetMin: 45 }];

// ---- 12/5 アカデミー：1試合・2人制 ----
const GAMES_1205_ACA: Game[] = [{ id: "sample-game6", no: 1, start: "09:30", opponent: "坂戸ジュニア", system: 2 }];
const SLOTS_1205_ACA = [slot("sample-game6", "plate", "相手"), slot("sample-game6", "base", "佐藤")];

export const SAMPLE_DAYS: DaySummary[] = [
  {
    date: "2026-10-10",
    mode: "single",
    activityType: "練習試合",
    units: [
      unit({
        id: "sample-u1",
        division: "storm",
        venue: "坂戸中学校",
        playerGatherTime: "07:30",
        gatherPlace: "現地集合",
        grounds: G_1003,
        ...deriveGround(G_1003),
        ...coaches("玉城", "田中", "佐藤"),
        games: GAMES_1003,
        umpireRequired: true,
        umpireNeeded: 4,
        umpireOffset: 60,
        umpireSlots: SLOTS_1003,
        umpirePeople: [],
      }),
    ],
  },
  {
    date: "2026-10-17",
    mode: "single",
    activityType: "練習",
    units: [
      unit({
        id: "sample-u2",
        division: "storm",
        venue: "住吉中学校",
        grounds: G_1010,
        ...deriveGround(G_1010),
        ...coaches(),
        games: [],
        umpireRequired: false,
        umpireNeeded: 0,
        umpireOffset: 60,
        umpireSlots: [],
        umpirePeople: [],
      }),
    ],
  },
  {
    date: "2026-12-05",
    mode: "split",
    activityType: "練習試合",
    units: [
      unit({
        id: "sample-u3",
        division: "top",
        venue: "坂戸中学校",
        playerGatherTime: "07:30",
        grounds: G_1205_TOP,
        ...deriveGround(G_1205_TOP),
        ...coaches("玉城", "田中", "鈴木"),
        games: GAMES_1205_TOP,
        umpireRequired: true,
        umpireNeeded: 4,
        umpireOffset: 60,
        umpireSlots: SLOTS_1205_TOP,
        umpirePeople: PEOPLE_1205_TOP,
      }),
      unit({
        id: "sample-u4",
        division: "academy",
        venue: "住吉中学校",
        playerGatherTime: "08:00",
        grounds: G_1205_ACA,
        ...deriveGround(G_1205_ACA),
        ...coaches("田中", "佐藤"),
        games: GAMES_1205_ACA,
        umpireRequired: true,
        umpireNeeded: 1,
        umpireOffset: 60,
        umpireSlots: SLOTS_1205_ACA,
        umpirePeople: [],
      }),
    ],
  },
];
