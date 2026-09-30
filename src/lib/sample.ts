// ============================================================
// STEP1 用のサンプルデータ（画面の見た目を確認するためだけのもの）
// STEP4 以降で Supabase（クラウドのデータベース）の本物のデータに置き換えます。
// ============================================================

import type { DaySummary } from "./status";

export const SAMPLE_DAYS: DaySummary[] = [
  {
    date: "2026-10-03",
    activityType: "練習試合",
    units: [
      {
        division: "storm",
        venue: "坂戸中学校",
        playerGatherTime: "07:30",
        groundState: "decided",
        groundName: "坂戸中学校",
        candidateCount: 2,
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
    activityType: "練習",
    units: [
      {
        division: "storm",
        venue: "住吉中学校",
        groundState: "checking",
        candidateCount: 3,
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
    activityType: "練習試合",
    units: [
      {
        division: "top",
        venue: "坂戸中学校",
        playerGatherTime: "07:30",
        groundState: "decided",
        groundName: "坂戸中学校",
        candidateCount: 1,
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
        division: "academy",
        venue: "住吉中学校",
        playerGatherTime: "08:00",
        groundState: "checking",
        candidateCount: 2,
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
