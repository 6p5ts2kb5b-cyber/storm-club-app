// ============================================================
// お試しモード用のサンプルデータ（画面の見た目・操作を確認するためだけのもの）
// Supabase（クラウドのデータベース）の設定が終わると、本物のデータに切り替わります。
// ============================================================

import { deriveGround, type Ground, type GroundStatus, type SchoolUse, type StormUse } from "./grounds";
import type { DaySummary } from "./status";

let seq = 0;
function g(school: string, status: GroundStatus, school_use: SchoolUse, storm_use: StormUse, note: string | null = null): Ground {
  seq += 1;
  return { id: `sample-g${seq}`, school_name: school, ground_name: null, school_use, storm_use, status, note };
}

const G_1003 = [g("坂戸中学校", "decided", "none", "ok"), g("住吉中学校", "unavailable", "planned", "ng", "学校の部活で使用")];
const G_1010 = [
  g("坂戸中学校", "checking", "unknown", "unknown", "教頭先生に確認中"),
  g("住吉中学校", "candidate", "unknown", "unknown"),
  g("北中学校", "candidate", "unknown", "unknown"),
];
const G_1205_TOP = [g("坂戸中学校", "decided", "none", "ok")];
const G_1205_ACA = [g("住吉中学校", "checking", "none", "unknown"), g("三芳中学校", "candidate", "unknown", "unknown")];

export const SAMPLE_DAYS: DaySummary[] = [
  {
    date: "2026-10-03",
    mode: "single",
    activityType: "練習試合",
    units: [
      {
        id: "sample-u1",
        division: "storm",
        venue: "坂戸中学校",
        playerGatherTime: "07:30",
        grounds: G_1003,
        ...deriveGround(G_1003),
        coaches: ["玉城", "田中", "佐藤"],
        umpireRequired: true,
        umpireNeeded: 4,
        umpireAssigned: 2,
        umpireGatherTime: "08:00",
        games: [
          { no: 1, start: "09:00" },
          { no: 2, start: "11:00" },
        ],
        openPositions: ["第1試合 二塁審", "第2試合 塁審"],
      },
    ],
  },
  {
    date: "2026-10-10",
    mode: "single",
    activityType: "練習",
    units: [
      {
        id: "sample-u2",
        division: "storm",
        venue: "住吉中学校",
        grounds: G_1010,
        ...deriveGround(G_1010),
        coaches: [],
        umpireRequired: false,
        umpireNeeded: 0,
        umpireAssigned: 0,
        games: [],
        openPositions: [],
      },
    ],
  },
  {
    date: "2026-12-05",
    mode: "split",
    activityType: "練習試合",
    units: [
      {
        id: "sample-u3",
        division: "top",
        venue: "坂戸中学校",
        playerGatherTime: "07:30",
        grounds: G_1205_TOP,
        ...deriveGround(G_1205_TOP),
        coaches: ["玉城", "田中", "鈴木"],
        umpireRequired: true,
        umpireNeeded: 4,
        umpireAssigned: 2,
        umpireGatherTime: "08:00",
        games: [
          { no: 1, start: "09:00" },
          { no: 2, start: "11:00" },
        ],
        openPositions: [],
      },
      {
        id: "sample-u4",
        division: "academy",
        venue: "住吉中学校",
        playerGatherTime: "08:00",
        grounds: G_1205_ACA,
        ...deriveGround(G_1205_ACA),
        coaches: ["田中", "佐藤"],
        umpireRequired: true,
        umpireNeeded: 2,
        umpireAssigned: 2,
        umpireGatherTime: "08:30",
        games: [{ no: 1, start: "09:30" }],
        openPositions: [],
      },
    ],
  },
];
