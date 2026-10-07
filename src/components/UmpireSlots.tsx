"use client";

// 試合ごとの審判の枠（1〜4人制）
// 枠をタップ → スタッフ または「相手チーム」を選ぶ。空いている枠は赤で表示。
import Lamp from "@/components/Lamp";
import { useState } from "react";
import type { StaffOption } from "@/lib/data";
import { formatTime } from "@/lib/divisions";
import type { Game } from "@/lib/status";
import {
  isFilled,
  matchupText,
  POSITION_LABEL,
  type Position,
  type Slot,
  SYSTEM_LABEL,
  SYSTEM_POSITIONS,
  systemOf,
  umpireTeamLabel,
  type UmpireSystem,
} from "@/lib/umpire";

export type SlotChoice = { staffId: string } | { opponent: true } | null;

export default function UmpireSlots({
  games,
  slots,
  staff,
  canEdit,
  canEditSystem,
  busyKey,
  onSetSlot,
  onSetSystem,
  onSetAllOpponent,
}: {
  games: Game[];
  slots: Slot[];
  staff: StaffOption[];
  /** 枠に人を入れられるか（管理者・スタッフ） */
  canEdit: boolean;
  /** 人数制を変えられるか（管理者） */
  canEditSystem: boolean;
  busyKey: string | null;
  onSetSlot: (game: Game, position: Position, choice: SlotChoice) => void;
  onSetSystem: (game: Game, system: UmpireSystem) => void;
  /** その試合の枠を、すべて「他チームが担当」にする */
  onSetAllOpponent: (game: Game) => void;
}) {
  const [picking, setPicking] = useState<{ game: Game; position: Position } | null>(null);
  const sorted = [...games].sort((a, b) => a.no - b.no);
  const nameOf = (id?: string) => staff.find((s) => s.id === id)?.name;

  if (sorted.length === 0) {
    return <p className="muted">先に上の「試合情報」で試合を登録すると、試合ごとの審判の枠が表示されます。</p>;
  }

  const current = picking ? slots.find((s) => s.gameId === picking.game.id && s.position === picking.position) : undefined;
  // 同じ試合のほかの枠にすでに入っている人（同じ試合で2つの役割はできない）
  const busyInGame = picking
    ? new Set(
        slots
          .filter((s) => s.gameId === picking.game.id && s.position !== picking.position && s.staffId)
          .map((s) => s.staffId as string),
      )
    : new Set<string>();
  const umpires = staff.filter((s) => (s.is_active && s.can_umpire) || s.id === current?.staffId);
  const fits = (s: StaffOption, pos: Position) => (pos === "plate" ? s.can_plate : s.can_base);

  return (
    <div className="slot-games">
      {sorted.map((g) => {
        const system = systemOf(g);
        const positions = SYSTEM_POSITIONS[system];
        const open = positions.filter((p) => !isFilled(slots.find((s) => s.gameId === g.id && s.position === p))).length;
        return (
          <div key={g.id ?? g.no} className={`slot-game${open ? " has-open" : ""}`}>
            <div className="slot-game__head">
              <span className="game__no">第{g.no}試合</span>
              <span className="slot-game__time">{g.start ? formatTime(g.start) : "時間未定"}</span>
              <span className="slot-game__match">{matchupText(g)}</span>
              <span className={`slot-game__state${open ? " is-ng" : " is-ok"}`}><Lamp level={open ? "ng" : "ok"} />
                {open ? `空き ${open}` : "全員決定"}</span>
            </div>

            <div className="system-row" role="radiogroup" aria-label={`第${g.no}試合の人数制`}>
              {([1, 2, 3, 4] as UmpireSystem[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={system === n}
                  className={`system-btn${system === n ? " is-active" : ""}`}
                  disabled={!canEditSystem || busyKey === `sys-${g.id}`}
                  onClick={() => system !== n && onSetSystem(g, n)}
                >
                  <span className="system-btn__box" aria-hidden="true">
                    {system === n ? "✓" : ""}
                  </span>
                  {SYSTEM_LABEL[n]}
                </button>
              ))}
            </div>

            <div className={`slot-grid slot-grid--${positions.length}`}>
              {positions.map((pos) => {
                const s = slots.find((x) => x.gameId === g.id && x.position === pos);
                const label = s?.opponent ? umpireTeamLabel(g) : s?.staffId ? s.staffName ?? nameOf(s.staffId) ?? "（不明）" : "空き";
                const state = s?.opponent ? "opp" : s?.staffId ? "staff" : "open";
                return (
                  <button
                    key={pos}
                    type="button"
                    className={`slot slot--${state}`}
                    disabled={!canEdit || busyKey === `${g.id}-${pos}`}
                    onClick={() => setPicking({ game: g, position: pos })}
                  >
                    <span className="slot__pos">{POSITION_LABEL[pos]}</span>
                    <span className="slot__who">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {picking && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setPicking(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2 className="sheet__title">
                第{picking.game.no}試合　{POSITION_LABEL[picking.position]}
              </h2>
              <button type="button" className="sheet__close" onClick={() => setPicking(null)} aria-label="閉じる">
                ×
              </button>
            </div>

            <button
              type="button"
              className={`pick-opp${current?.opponent ? " is-on" : ""}`}
              onClick={() => {
                onSetSlot(picking.game, picking.position, { opponent: true });
                setPicking(null);
              }}
            >
              <span className="pick-opp__icon" aria-hidden="true">
                ⇄
              </span>
              {umpireTeamLabel(picking.game)}が担当
            </button>
            <button
              type="button"
              className="btn btn--block btn--outline pick-all-opp"
              onClick={() => {
                onSetAllOpponent(picking.game);
                setPicking(null);
              }}
            >
              この試合は全員「{umpireTeamLabel(picking.game)}」が担当
            </button>

            <p className="field__label pick-label">STORMのスタッフから選ぶ</p>
            {umpires.length === 0 ? (
              <p className="muted">審判ができるスタッフがいません。「スタッフ」画面で「審判」をオンにしてください。</p>
            ) : (
              <div className="name-grid">
                {umpires.map((s) => {
                  const on = current?.staffId === s.id;
                  const taken = busyInGame.has(s.id);
                  const ok = fits(s, picking.position);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`name-btn${on ? " is-on" : ""}${ok ? "" : " is-weak"}`}
                      disabled={taken}
                      onClick={() => {
                        onSetSlot(picking.game, picking.position, { staffId: s.id });
                        setPicking(null);
                      }}
                    >
                      <span className="name-btn__mark" aria-hidden="true">
                        {on ? "✓" : ""}
                      </span>
                      <span className="name-btn__col">
                        <span className="name-btn__name">{s.name}</span>
                        <span className="name-btn__sub">
                          {taken
                            ? "この試合で別の役割"
                            : ok
                              ? picking.position === "plate"
                                ? "球審OK"
                                : "塁審OK"
                              : picking.position === "plate"
                                ? "球審は未登録"
                                : "塁審は未登録"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {isFilled(current) && (
              <button
                type="button"
                className="btn btn--danger btn--block pick-clear"
                onClick={() => {
                  onSetSlot(picking.game, picking.position, null);
                  setPicking(null);
                }}
              >
                空きに戻す
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
