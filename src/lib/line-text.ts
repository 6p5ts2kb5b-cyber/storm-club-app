// ============================================================
// LINEに送る連絡文を作る（決まっている内容だけをまとめます）
// ============================================================

import { DIVISION_LABEL, formatDateLong, formatTime } from "./divisions";
import { mdw } from "./reserve";
import { isRest, reserveText, restWhy, type UnitSummary } from "./status";
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
    lines.push(`${reserveText(unit) ? `${reserveText(unit)}です。` : ""}${reserveText(unit) ? `${unit.tournamentName}が実施されたため` : restWhy(unit)}、この日は休養日（練習はありません）です。`);
    if (unit.note) {
      lines.push("");
      lines.push("■連絡");
      lines.push(unit.note);
    }
    return lines.join("\n");
  }
  if (unit.tournamentName && unit.tournamentState === "postponed") {
    lines.push(`※${unit.tournamentName}が延期になったため、この日に大会を行います。`);
    lines.push("");
  } else if (unit.tournamentName && unit.tournamentState === "not_held" && unit.tournamentDate) {
    lines.push(`※${reserveText(unit)}です。大会が実施されたため、この日は練習です。`);
    lines.push("");
  } else if (unit.tournamentName && unit.tournamentState !== "not_held") {
    lines.push(
      unit.tournamentDate
        ? `※${reserveText(unit)}です。大会が実施された場合は休養日または練習（下の予定）、延期の場合はこの日に大会を行います。決まり次第あらためて連絡します。`
        : `※${unit.tournamentName}が実施される場合は休養日です。実施されない場合は、下の予定で練習をします。決まり次第あらためて連絡します。`,
    );
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

  if (unit.reserveDate) {
    lines.push("");
    lines.push(`■予備日　${mdw(unit.reserveDate)}${unit.reserveVenue ? `　${unit.reserveVenue}` : place ? `　${place}` : ""}`);
    lines.push(`　延期の場合は、この日に${unit.reserveName || unit.activityType || "大会"}を行います。`);
    if (unit.reserveUmpires?.length) lines.push(`　審判　${unit.reserveUmpires.join("／")}`);
  }
  if (unit.reserve2Date) {
    lines.push("");
    lines.push(`■予備日の予備日　${mdw(unit.reserve2Date)}${unit.reserve2Venue ? `　${unit.reserve2Venue}` : ""}`);
    lines.push(`　${unit.reserveDate ? `${mdw(unit.reserveDate)}も延期の場合は、` : ""}この日に${unit.reserveName || unit.activityType || "大会"}を行います。`);
    if (unit.reserve2Umpires?.length) lines.push(`　審判　${unit.reserve2Umpires.join("／")}`);
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

/** 予備日の審判のお知らせ（ギリギリまで決まらないので、決まったらすぐ送れる文章） */
export function buildReserveNotice(date: string, unit: UnitSummary): string {
  if (!unit.reserveDate) return "";
  const title = unit.division === "storm" ? "STORMクラブ" : `STORMクラブ ${DIVISION_LABEL[unit.division]}`;
  const have = unit.reserveUmpires ?? [];
  const short = unit.umpireRequired ? Math.max(0, unit.umpireNeeded - have.length) : 0;
  const place = unit.reserveVenue || unit.venue || (unit.groundState === "decided" ? unit.groundName : undefined);
  const lines: string[] = [];
  lines.push(`【${title}】予備日の審判のお知らせ`);
  lines.push(`${mdw(date)}の${unit.reserveName || unit.activityType || "大会"}が延期になった場合は、${mdw(unit.reserveDate)}に行います。`);
  if (place) lines.push(`■会場　${place}`);
  lines.push("");
  if (have.length) lines.push(`■審判　${have.join("／")}`);
  if (unit.umpireRequired) {
    lines.push(
      short === 0
        ? "審判は決まりました。よろしくお願いします。"
        : `${have.length ? `あと${short}名` : "審判"}は、決まり次第あらためてお知らせします。`,
    );
  }
  return lines.join("\n");
}

/** LINEの共有画面を開くURL（送り先はLINEの画面で選びます） */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}
