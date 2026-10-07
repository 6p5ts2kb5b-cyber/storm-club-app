// ============================================================
// 準備状況（🟢🟡🔴）を判定するルール
// 状態はデータベースに保存せず、毎回ここで計算します。
// こうすることで「人数はそろったのに表示が🔴のまま」というズレが起きません。
// ============================================================

import { DIVISION_LABEL, type DayMode, type Division, formatTime } from "./divisions";
import type { Ground } from "./grounds";
import type { Slot, UmpirePerson } from "./umpire";

/** 1つの試合 */
export interface Game {
  id?: string;
  no: number;
  /** 試合開始時間 "09:00"（未定なら空） */
  start?: string;
  /** 対戦相手（STORMが出ない試合では、一方のチーム名） */
  opponent?: string;
  /** STORMが試合に出るか（false = 審判だけ担当する試合。未設定は出る） */
  stormPlays?: boolean;
  /** STORMが出ない試合の、もう一方のチーム名 */
  opponent2?: string;
  /** 「他チームが担当」の審判を出すチーム名（例：第1試合の勝者） */
  umpireTeam?: string;
  /** 審判の人数制（1〜4人制。基本は4人制） */
  system?: 1 | 2 | 3 | 4;
  note?: string;
}

/** ok = 🟢 完了・確定 / warn = 🟡 確認中 / ng = 🔴 未確定・不足 / none = 対象外 */
export type Level = "ok" | "warn" | "ng" | "none";

/** 1つの活動で必要な審判の最大人数 */
export const MAX_UMPIRES = 8;

export const LEVEL_EMOJI: Record<Level, string> = {
  ok: "🟢",
  warn: "🟡",
  ng: "🔴",
  none: "⚪",
};

/** ホーム画面で使う「活動単位（トップ／アカデミー／STORM の1日分）」の要約 */
export interface UnitSummary {
  /** データベースの番号（お試しモードでは空） */
  id?: string;
  division: Division;
  activityType?: string;
  note?: string;
  venue?: string;
  playerGatherTime?: string;
  /** decided = 使用決定 / checking = 確認中あり / undecided = 候補はあるが未決定 / none = 未確保 */
  groundState: "decided" | "checking" | "undecided" | "none";
  groundName?: string;
  candidateCount: number;
  /** グラウンド候補の一覧（詳細画面で使用） */
  grounds?: Ground[];
  coaches: string[];
  /** 参加指導者のスタッフ番号（詳細画面での選択に使用） */
  coachIds?: string[];
  /** 選手の集合場所（現地・学校・駅など） */
  gatherPlace?: string;
  umpireRequired: boolean;
  umpireNeeded: number;
  /** 審判をするSTORMのスタッフの人数（自動集計） */
  umpireAssigned: number;
  /** 実際に使う審判集合時間（手動 ＞ 自動） */
  umpireGatherTime?: string;
  /** 自動計算した審判集合時間（第1試合 − 何分前） */
  umpireGatherAuto?: string;
  /** 管理者が手動で決めた審判集合時間 */
  umpireGatherManual?: string;
  /** 試合開始の何分前に集合か */
  umpireOffset?: number;
  /** 試合ごとの審判の枠 */
  umpireSlots?: Slot[];
  /** 審判一人ずつの集合時間の設定 */
  umpirePeople?: UmpirePerson[];
  games: Game[];
  /** 空いている審判ポジション（例：「第1試合 二塁審」） */
  openPositions: string[];
}

export interface DaySummary {
  id?: string;
  date: string;
  mode: DayMode;
  activityType: string;
  note?: string;
  units: UnitSummary[];
}

/** 画面に1行ずつ出す「項目と状態」 */
export interface CheckItem {
  key: string;
  label: string;
  level: Level;
  text: string;
}

/** 活動単位の各項目の状態を判定します */
export function checkUnit(u: UnitSummary): CheckItem[] {
  const items: CheckItem[] = [];

  // グラウンド
  if (u.groundState === "decided") {
    items.push({ key: "ground", label: "グラウンド", level: "ok", text: u.groundName ? `確定（${u.groundName}）` : "確定" });
  } else if (u.groundState === "checking") {
    items.push({ key: "ground", label: "グラウンド", level: "warn", text: `確認中（候補${u.candidateCount}校）` });
  } else if (u.groundState === "undecided") {
    items.push({ key: "ground", label: "グラウンド", level: "warn", text: `未決定（候補${u.candidateCount}校）` });
  } else {
    items.push({ key: "ground", label: "グラウンド", level: "ng", text: "未確保" });
  }

  // 選手集合時間
  items.push(
    u.playerGatherTime
      ? { key: "player", label: "選手集合", level: "ok", text: formatTime(u.playerGatherTime) }
      : { key: "player", label: "選手集合", level: "ng", text: "未設定" },
  );

  // 指導者
  items.push(
    u.coaches.length > 0
      ? { key: "coach", label: "指導者", level: "ok", text: `${u.coaches.length}名（${u.coaches.join("・")}）` }
      : { key: "coach", label: "指導者", level: "ng", text: "未確定" },
  );

  // 審判（人数）
  if (!u.umpireRequired) {
    items.push({ key: "umpire", label: "審判", level: "none", text: "不要" });
  } else {
    const short = Math.max(0, u.umpireNeeded - u.umpireAssigned);
    items.push(
      short === 0
        ? { key: "umpire", label: "審判", level: "ok", text: `確定（${u.umpireAssigned}名）` }
        : { key: "umpire", label: "審判", level: "ng", text: `あと${short}名（${u.umpireAssigned}/${u.umpireNeeded}名）` },
    );
  }

  // 審判集合時間
  if (u.umpireRequired) {
    items.push(
      u.umpireGatherTime
        ? { key: "umpireGather", label: "審判集合", level: "ok", text: formatTime(u.umpireGatherTime) }
        : {
            key: "umpireGather",
            label: "審判集合",
            level: "ng",
            text: u.games.some((g) => g.start) ? "未設定" : "未設定（試合時間が未入力）",
          },
    );
  }

  return items;
}

/** ホームの「要確認」に出す1件 */
export interface Issue {
  date: string;
  division: Division;
  divisionLabel: string;
  level: Level;
  text: string;
}

/** 活動日の一覧から、🔴と🟡だけを取り出します（🔴が先） */
export function collectIssues(days: DaySummary[]): Issue[] {
  const issues: Issue[] = [];
  for (const day of days) {
    for (const u of day.units) {
      for (const item of checkUnit(u)) {
        if (item.level === "ng" || item.level === "warn") {
          issues.push({
            date: day.date,
            division: u.division,
            divisionLabel: DIVISION_LABEL[u.division],
            level: item.level,
            text: `${item.label} ${item.text}`,
          });
        }
      }
      for (const pos of u.openPositions) {
        issues.push({
          date: day.date,
          division: u.division,
          divisionLabel: DIVISION_LABEL[u.division],
          level: "ng",
          text: `${pos} 空き`,
        });
      }
    }
  }
  // 日付の近い順、同じ日なら🔴を先に
  return issues.sort((a, b) => a.date.localeCompare(b.date) || (a.level === b.level ? 0 : a.level === "ng" ? -1 : 1));
}

/** 活動単位全体の一番悪い状態 */
export function worstLevel(u: UnitSummary): Level {
  const levels = checkUnit(u).map((i) => i.level);
  if (levels.includes("ng") || u.openPositions.length > 0) return "ng";
  if (levels.includes("warn")) return "warn";
  return "ok";
}
