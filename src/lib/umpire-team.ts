// 大会の試合で「どこのチームが審判を出すか」の組み合わせ（1チーム／相手の試合の2チームから○名ずつ／連盟から○名）
// 保存は試合の umpire_team（文字）。1チームだけなら今までどおりの文字、組み合わせは「@s{JSON}」で保存します。
import { OUR, parseRef, resolveGames } from "@/lib/league";
import type { Game } from "@/lib/status";

/** 保護者・相手チーム向けに出す、自チームの名前 */
export const OUR_NAME = "STORMクラブ";

/** items＝出すチーム（「第1試合の敗者」も可）、n＝各チームから何名（0＝書かない）、fed＝連盟から何名 */
export type UmpSet = { items: string[]; n: number; fed: number };

export function parseUmp(u: string | undefined): UmpSet {
  const s = (u ?? "").trim();
  if (!s) return { items: [], n: 0, fed: 0 };
  if (s.startsWith("@s")) {
    try {
      const o = JSON.parse(s.slice(2)) as { t?: unknown; n?: unknown; f?: unknown };
      return {
        items: Array.isArray(o.t) ? o.t.map(String).filter(Boolean) : [],
        n: Number(o.n) || 0,
        fed: Number(o.f) || 0,
      };
    } catch {
      return { items: [], n: 0, fed: 0 };
    }
  }
  return { items: [s], n: 0, fed: 0 };
}

export function encodeUmp(x: UmpSet): string {
  if (x.items.length <= 1 && !x.n && !x.fed) return x.items[0] ?? "";
  return `@s${JSON.stringify({ t: x.items, n: x.n, f: x.fed })}`;
}

/** 「第1・第2試合の敗者より1名ずつ、連盟より2名」。name でチーム名に読みかえる */
export function umpText(x: UmpSet, name: (t: string) => string = (t) => t): string {
  const names = x.items.map(name);
  const refs = names.map((t) => parseRef(t));
  let who: string;
  if (names.length >= 2 && refs.every((r) => r) && refs.every((r) => r!.win === refs[0]!.win)) {
    who = `${refs.map((r) => `第${r!.game}`).join("・")}試合の${refs[0]!.win ? "勝者" : "敗者"}`;
  } else who = names.join("・");
  const parts: string[] = [];
  if (who) parts.push(x.n ? `${who}より${x.n}名${names.length >= 2 ? "ずつ" : ""}` : who);
  if (x.fed) parts.push(`連盟より${x.fed}名`);
  return parts.join("、");
}

const bySort = (games: Game[]) => [...games].sort((a, b) => a.no - b.no);

/** 試合の2チームの名前（自チームは「STORMクラブ」） */
export function gameTeams(g: Game): string[] {
  return (g.stormPlays === false ? [g.opponent ?? "", g.opponent2 ?? ""] : [OUR_NAME, g.opponent ?? ""])
    .map((t) => t.trim())
    .filter(Boolean);
}

/** この日のチーム（「第1試合の勝者」などは数えない） */
export function dayTeamNames(games: Game[]): string[] {
  return [...new Set(bySort(games).flatMap(gameTeams).filter((t) => !parseRef(t)))];
}

/** 審判の自動（大会で、チームが3つ・3試合の日：2試合目＝第1試合の勝者、3試合目＝第1試合の敗者） */
export function autoUmpire(type: string | undefined, games: Game[], i: number): string {
  if (type !== "公式戦" && type !== "大会") return "";
  if (games.length !== 3 || dayTeamNames(games).length !== 3) return "";
  return i === 1 ? "第1試合の勝者" : i === 2 ? "第1試合の敗者" : "";
}

/** この試合の審判（手で入れたもの、なければ自動）。i は試合の順番（0から） */
export function umpireOf(type: string | undefined, games: Game[], i: number): string {
  const sorted = bySort(games);
  return (sorted[i]?.umpireTeam ?? "").trim() || autoUmpire(type, sorted, i);
}

/** 結果が入っていれば「第1試合の敗者」を本当のチーム名にして、審判の文にする */
export function resolveRefName(t: string, games: Game[]): string {
  const r = parseRef(t);
  if (!r) return t;
  const res = resolveGames(games);
  const p = res[r.game - 1];
  if (!p || p.a == null || p.b == null || p.sa == null || p.sb == null || p.sa === p.sb) return `第${r.game}試合の${r.win ? "勝者" : "敗者"}`;
  const n = r.win === p.sa > p.sb ? p.a : p.b;
  return n === OUR ? OUR_NAME : n;
}

export function umpireName(type: string | undefined, games: Game[], i: number): string {
  const u = umpireOf(type, games, i);
  if (!u) return "";
  return umpText(parseUmp(u), (t) => resolveRefName(t, bySort(games)));
}

/** 「他チームが担当」に出す名前（組み合わせならその文。結果が入っていればチーム名に読みかえ） */
export function umpireTeamText(umpireTeam: string | undefined, games?: Game[]): string {
  const s = (umpireTeam ?? "").trim();
  if (!s) return "";
  return umpText(parseUmp(s), games ? (t) => resolveRefName(t, bySort(games)) : undefined);
}
