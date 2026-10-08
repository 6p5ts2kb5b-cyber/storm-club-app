// ============================================================
// LINEに送る連絡文を作る（決まっている内容だけをまとめます）
// ============================================================

import { DIVISION_LABEL, formatDateLong, formatTime } from "./divisions";
import { isRest, reserveText, type UnitSummary } from "./status";
import {
  isFilled,
  matchupText,
  POSITION_LABEL,
  SYSTEM_LABEL,
  SYSTEM_POSITIONS,
  systemOf,
  umpireTeamLabel,
} from "./umpire";

export function buildLineMessage(date: string, unit: UnitSummary): string {
  const lines: string[] = [];
  const title = unit.division === "storm" ? "STORMクラブ" : `STORMクラブ ${DIVISION_LABEL[unit.division]}`;
  lines.push(`【${title}】`);
  lines.push(`${formatDateLong(date)}${isRest(unit) ? " 休み" : unit.activityType ? ` ${unit.activityType}` : ""}`);
  lines.push("");

  if (isRest(unit)) {
    lines.push(`■休み`);
    lines.push(`${reserveText(unit) ? `${reserveText(unit)}です。` : ""}${unit.tournamentName}が実施されたため、この日は休養日（練習はありません）です。`);
    if (unit.note) {
      lines.push("");
      lines.push("■連絡");
      lines.push(unit.note);
    }
    return lines.join("\n");
  }
  if (unit.tournamentName && unit.tournamentState !== "not_held") {
    lines.push(`※${reserveText(unit) ? `${reserveText(unit)}です。` : ""}${unit.tournamentName}が実施される場合は休養日です。実施されない場合は、下の予定で練習をします。決まり次第あらためて連絡します。`);
    lines.push("");
  }

  const place = unit.venue || (unit.groundState === "decided" ? unit.groundName : undefined);
  if (place) lines.push(`■会場　${place}`);
  if (unit.playerGatherTime) {
    lines.push(`■選手集合　${formatTime(unit.playerGatherTime)}${unit.gatherPlace ? `（${unit.gatherPlace}）` : ""}`);
  } else if (unit.gatherPlace) {
    lines.push(`■集合場所　${unit.gatherPlace}`);
  }
  if (unit.umpireRequired && unit.umpireGatherTime) lines.push(`■審判集合　${formatTime(unit.umpireGatherTime)}`);

  const games = [...unit.games].sort((a, b) => a.no - b.no);
  if (games.length) {
    lines.push("");
    lines.push("■試合");
    for (const g of games) {
      const t = g.start ? formatTime(g.start) : "時間未定";
      const note = g.stormPlays === false ? "（STORMは審判のみ）" : "";
      lines.push(`第${g.no}試合　${t}　${matchupText(g)}${note}`);
      if (g.note) lines.push(`　※${g.note}`);
    }
  }

  if (unit.umpireRequired && games.length) {
    const slots = unit.umpireSlots ?? [];
    const rows: string[] = [];
    for (const g of games) {
      const positions = SYSTEM_POSITIONS[systemOf(g)];
      const mine = positions.map((pos) => ({ pos, slot: slots.find((s) => s.gameId === g.id && s.position === pos) }));
      if (mine.every((m) => !isFilled(m.slot))) {
        rows.push(`第${g.no}試合　未定`);
        continue;
      }
      const team = umpireTeamLabel(g);
      if (mine.every((m) => m.slot?.opponent)) {
        rows.push(`第${g.no}試合　${team}`);
        continue;
      }
      const parts = mine.map(({ pos, slot }) => {
        const who = slot?.opponent ? team : slot?.staffId ? slot.staffName ?? "（不明）" : "未定";
        return `${POSITION_LABEL[pos]} ${who}`;
      });
      rows.push(`第${g.no}試合　${parts.join("／")}`);
    }
    lines.push("");
    lines.push(`■審判（${[...new Set(games.map((g) => SYSTEM_LABEL[systemOf(g)]))].join("・")}）`);
    lines.push(...rows);
  }

  if (unit.coaches.length) {
    lines.push("");
    lines.push(`■指導者　${unit.coaches.join("・")}`);
  }
  if (unit.note) {
    lines.push("");
    lines.push(`■連絡`);
    lines.push(unit.note);
  }
  return lines.join("\n");
}

/** LINEの共有画面を開くURL（送り先はLINEの画面で選びます） */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}
