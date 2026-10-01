"use client";

// 審判（STEP10〜12）
//   1. 必要人数        … 不要／1〜8名（管理者）
//   2. 審判集合時間    … 第1試合の開始時間 − 何分前 で自動計算。手動で修正も可能（管理者）
//   3. 試合ごとの枠    … 1〜4人制、枠ごとにスタッフ または 相手チーム（管理者・スタッフ）
//   4. 審判担当一覧    … 一人ずつの担当試合・役割・集合時間（PCは表、iPhoneはカード）
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TimeField from "@/components/TimeField";
import UmpireNeedPicker from "@/components/UmpireNeedPicker";
import UmpireSlots, { type SlotChoice } from "@/components/UmpireSlots";
import { saveUmpireNeed } from "@/lib/activity-actions";
import type { StaffOption } from "@/lib/data";
import { formatTime } from "@/lib/divisions";
import type { Game, UnitSummary } from "@/lib/status";
import {
  buildRoster,
  DEFAULT_OFFSET,
  OFFSET_CHOICES,
  type Position,
  type RosterRow,
  SYSTEM_POSITIONS,
  type UmpirePerson,
  timeMinus,
  type UmpireSystem,
} from "@/lib/umpire";
import { savePerson, saveUnitGather, setGameSystem, setSlot } from "@/lib/umpire-actions";

type Notify = (kind: "ok" | "ng", text: string) => void;

export default function UmpireSection({
  unit,
  staff,
  isAdmin,
  canEdit,
  demo,
  onPatch,
  notify,
}: {
  unit: UnitSummary;
  staff: StaffOption[];
  isAdmin: boolean;
  canEdit: boolean;
  demo: boolean;
  onPatch: (patch: Partial<UnitSummary>) => void;
  notify: Notify;
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<RosterRow | null>(null);

  const slots = unit.umpireSlots ?? [];
  const people = unit.umpirePeople ?? [];
  const offset = unit.umpireOffset ?? DEFAULT_OFFSET;
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "（不明）";
  const roster = buildRoster(unit.games, slots, people, offset, nameOf);
  const live = !demo && Boolean(unit.id);
  const done = (text: string) => notify("ok", live ? text : `${text}（お試しモード）`);

  // ---- 1. 必要人数 ----
  async function changeNeed(required: boolean, needed: number) {
    const before = { umpireRequired: unit.umpireRequired, umpireNeeded: unit.umpireNeeded };
    onPatch({ umpireRequired: required, umpireNeeded: needed });
    if (!live) return done("保存しました");
    setBusyKey("need");
    const r = await saveUmpireNeed(unit.id as string, required, needed);
    setBusyKey(null);
    if (!r.ok) {
      onPatch(before);
      return notify("ng", r.message);
    }
    done("保存しました");
    router.refresh();
  }

  // ---- 3. 枠 ----
  async function changeSlot(game: Game, position: Position, choice: SlotChoice) {
    if (!game.id) return;
    const before = slots;
    const rest = slots.filter((s) => !(s.gameId === game.id && s.position === position));
    const next =
      choice === null
        ? rest
        : [
            ...rest,
            "staffId" in choice
              ? { gameId: game.id, position, opponent: false, staffId: choice.staffId, staffName: nameOf(choice.staffId) }
              : { gameId: game.id, position, opponent: true },
          ];
    onPatch({ umpireSlots: next });
    const who = choice === null ? "空き" : "staffId" in choice ? `${nameOf(choice.staffId)}さん` : "相手チーム";
    if (!live) return done(`第${game.no}試合を「${who}」にしました`);
    setBusyKey(`${game.id}-${position}`);
    const r = await setSlot(game.id, position, choice);
    setBusyKey(null);
    if (!r.ok) {
      onPatch({ umpireSlots: before });
      return notify("ng", r.message);
    }
    done(`第${game.no}試合を「${who}」にしました`);
    router.refresh();
  }

  async function changeSystem(game: Game, system: UmpireSystem) {
    if (!game.id) return;
    const keep = SYSTEM_POSITIONS[system];
    const lost = slots.filter((s) => s.gameId === game.id && !keep.includes(s.position) && (s.staffId || s.opponent));
    if (lost.length && !window.confirm(`${system}人制にすると、入力済みの審判（${lost.length}枠）の割り当てが外れます。よろしいですか？`)) {
      return;
    }
    const beforeGames = unit.games;
    const beforeSlots = slots;
    onPatch({
      games: unit.games.map((g) => (g.id === game.id ? { ...g, system } : g)),
      umpireSlots: slots.filter((s) => s.gameId !== game.id || keep.includes(s.position)),
    });
    if (!live) return done(`第${game.no}試合を${system}人制にしました`);
    setBusyKey(`sys-${game.id}`);
    const r = await setGameSystem(game.id, system);
    setBusyKey(null);
    if (!r.ok) {
      onPatch({ games: beforeGames, umpireSlots: beforeSlots });
      return notify("ng", r.message);
    }
    done(`第${game.no}試合を${system}人制にしました`);
    router.refresh();
  }

  // ---- 2. 集合時間（活動全体） ----
  async function changeUnitGather(nextOffset: number, manual: string | null): Promise<boolean> {
    if (live) {
      const r = await saveUnitGather(unit.id as string, nextOffset, manual);
      if (!r.ok) {
        notify("ng", r.message);
        return false;
      }
    }
    onPatch({ umpireOffset: nextOffset, umpireGatherManual: manual ?? undefined });
    done("保存しました");
    if (live) router.refresh();
    return true;
  }

  // ---- 4. 一人ずつの集合時間 ----
  async function changePerson(staffId: string, v: { offsetMin: number | null; gatherTime: string | null; note: string | null }) {
    if (live) {
      const r = await savePerson(unit.id as string, staffId, v);
      if (!r.ok) {
        notify("ng", r.message);
        return false;
      }
    }
    const rest = people.filter((p) => p.staffId !== staffId);
    const empty = v.offsetMin === null && !v.gatherTime && !v.note;
    const next: UmpirePerson[] = empty
      ? rest
      : [
          ...rest,
          { staffId, offsetMin: v.offsetMin ?? undefined, gatherTime: v.gatherTime ?? undefined, note: v.note ?? undefined },
        ];
    onPatch({ umpirePeople: next });
    done("保存しました");
    if (live) router.refresh();
    return true;
  }

  return (
    <>
      <UmpireNeedPicker
        required={unit.umpireRequired}
        needed={unit.umpireNeeded}
        assigned={unit.umpireAssigned}
        disabled={!isAdmin || busyKey === "need"}
        onChange={changeNeed}
      />

      {unit.umpireRequired && (
        <>
          <div className="detail-block">
            <UnitGatherSetting unit={unit} canEdit={isAdmin} onSave={changeUnitGather} />
          </div>

          <div className="detail-block">
            <section className="panel">
              <div className="panel__row">
                <h2 className="panel__title">試合ごとの審判</h2>
                <span className={`count-badge${unit.openPositions.length ? " count-badge--ng" : " count-badge--ok"}`}>
                  {unit.openPositions.length ? `空き ${unit.openPositions.length}枠` : "全枠決定"}
                </span>
              </div>
              <UmpireSlots
                games={unit.games}
                slots={slots}
                staff={staff}
                canEdit={canEdit}
                canEditSystem={isAdmin}
                busyKey={busyKey}
                onSetSlot={changeSlot}
                onSetSystem={changeSystem}
              />
            </section>
          </div>

          <div className="detail-block">
            <section className="panel">
              <div className="panel__row">
                <h2 className="panel__title">審判担当一覧</h2>
                <span className="count-badge">STORM {unit.umpireAssigned}名</span>
              </div>
              {roster.length === 0 ? (
                <p className="muted">まだ誰も割り当てられていません。</p>
              ) : (
                <>
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>審判者</th>
                        <th>集合</th>
                        <th>担当試合</th>
                        <th>試合数</th>
                        <th>役割</th>
                        <th>備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((r) => (
                        <tr
                          key={r.key}
                          className={r.opponent ? "is-opp" : isAdmin ? "is-tap" : ""}
                          onClick={() => !r.opponent && isAdmin && setEditingPerson(r)}
                        >
                          <td className="roster-name">{r.name}</td>
                          <td className="roster-time">
                            {r.gather ? formatTime(r.gather) : r.opponent ? "−" : <span className="txt-ng">未定</span>}
                            {r.gatherSource === "manual" && <span className="tag-manual">手動</span>}
                          </td>
                          <td>{r.rangeText}</td>
                          <td>{r.gameCount}試合</td>
                          <td>{r.positions}</td>
                          <td className="muted">{r.note ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <ul className="roster-cards">
                    {roster.map((r) => (
                      <li key={r.key}>
                        <button
                          type="button"
                          className={`roster-card${r.opponent ? " is-opp" : ""}`}
                          disabled={r.opponent || !isAdmin}
                          onClick={() => setEditingPerson(r)}
                        >
                          <span className="roster-card__top">
                            <span className="roster-card__name">{r.name}</span>
                            {!r.opponent && (
                              <span className="roster-card__time">
                                集合 {r.gather ? formatTime(r.gather) : <span className="txt-ng">未定</span>}
                                {r.gatherSource === "manual" && <span className="tag-manual">手動</span>}
                              </span>
                            )}
                          </span>
                          <span className="roster-card__facts">
                            <span>担当：{r.rangeText}</span>
                            <span>{r.gameCount}試合</span>
                            <span>役割：{r.positions}</span>
                          </span>
                          {r.note && <span className="roster-card__note">{r.note}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {isAdmin && <p className="field__hint">名前をタップすると、その人だけの集合時間を変えられます</p>}
                </>
              )}
            </section>
          </div>
        </>
      )}

      {editingPerson?.staffId && (
        <PersonSheet
          row={editingPerson}
          person={people.find((p) => p.staffId === editingPerson.staffId)}
          unitOffset={offset}
          firstGame={unit.games.find((g) => g.no === Math.min(...editingPerson.gameNos))}
          onClose={() => setEditingPerson(null)}
          onSave={async (v) => {
            const ok = await changePerson(editingPerson.staffId as string, v);
            if (ok) setEditingPerson(null);
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------
// 活動全体の審判集合時間（自動計算＋手動修正）
// ------------------------------------------------------------
function OffsetPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const isPreset = OFFSET_CHOICES.includes(value);
  const [free, setFree] = useState(!isPreset);
  return (
    <div className="offset-picker">
      <div className="offset-grid">
        {OFFSET_CHOICES.map((n) => (
          <button
            key={n}
            type="button"
            className={`chip-btn${!free && value === n ? " is-active" : ""}`}
            disabled={disabled}
            onClick={() => {
              setFree(false);
              onChange(n);
            }}
          >
            {n}分前
          </button>
        ))}
        <button type="button" className={`chip-btn${free ? " is-active" : ""}`} disabled={disabled} onClick={() => setFree(true)}>
          自由
        </button>
      </div>
      {free && (
        <label className="offset-free">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            step={5}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
          />
          <span>分前に集合</span>
        </label>
      )}
    </div>
  );
}

function UnitGatherSetting({
  unit,
  canEdit,
  onSave,
}: {
  unit: UnitSummary;
  canEdit: boolean;
  onSave: (offset: number, manual: string | null) => Promise<boolean>;
}) {
  const savedOffset = unit.umpireOffset ?? DEFAULT_OFFSET;
  const savedManual = unit.umpireGatherManual ?? "";
  const [offset, setOffset] = useState(savedOffset);
  const [manualOn, setManualOn] = useState(Boolean(savedManual));
  const [manual, setManual] = useState(savedManual);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOffset(savedOffset);
    setManual(savedManual);
    setManualOn(Boolean(savedManual));
  }, [savedOffset, savedManual]);

  const first = [...unit.games].sort((a, b) => a.no - b.no).find((g) => g.start);
  const auto = first?.start ? timeMinus(first.start, offset) : undefined;
  const shown = manualOn && manual ? manual : auto;
  const changed = offset !== savedOffset || (manualOn ? manual : "") !== savedManual;

  async function save() {
    setBusy(true);
    await onSave(offset, manualOn && manual ? manual : null);
    setBusy(false);
  }

  return (
    <section className="panel">
      <div className="panel__row">
        <h2 className="panel__title">審判集合時間</h2>
        {!unit.umpireGatherTime && <span className="count-badge count-badge--ng">未設定</span>}
      </div>

      <div className={`gather-result${shown ? "" : " is-empty"}`}>
        <span className="gather-result__time">{shown ? formatTime(shown) : "--:--"}</span>
        <span className="gather-result__how">
          {manualOn && manual
            ? "手動で設定した時間"
            : first?.start
              ? `第${first.no}試合 ${formatTime(first.start)} の${offset}分前（自動計算）`
              : "試合時間を入力すると自動で計算されます"}
        </span>
      </div>

      {canEdit && (
        <>
          <p className="field__label">試合開始の何分前に集合？</p>
          <OffsetPicker value={offset} onChange={setOffset} />

          <div className="seg seg--2 manual-toggle">
            <button type="button" className={`seg__btn${!manualOn ? " is-active" : ""}`} onClick={() => setManualOn(false)}>
              自動計算
            </button>
            <button
              type="button"
              className={`seg__btn${manualOn ? " is-active" : ""}`}
              onClick={() => {
                setManualOn(true);
                if (!manual && auto) setManual(auto);
              }}
            >
              手動で決める
            </button>
          </div>
          {manualOn && <TimeField value={manual} onChange={setManual} label="審判集合時間" baseForAdjust={auto ?? "08:00"} />}

          <div className="panel__actions">
            <button type="button" className="btn btn--primary" onClick={save} disabled={!changed || busy}>
              {busy ? "保存しています…" : changed ? "保存する" : "保存済み"}
            </button>
          </div>
        </>
      )}
      <p className="field__hint">一人ずつの集合時間は、下の「審判担当一覧」で担当する試合から自動で計算されます。</p>
    </section>
  );
}

// ------------------------------------------------------------
// 審判一人の集合時間（何分前・手動・備考）
// ------------------------------------------------------------
function PersonSheet({
  row,
  person,
  unitOffset,
  firstGame,
  onClose,
  onSave,
}: {
  row: RosterRow;
  person?: UmpirePerson;
  unitOffset: number;
  firstGame?: Game;
  onClose: () => void;
  onSave: (v: { offsetMin: number | null; gatherTime: string | null; note: string | null }) => Promise<void>;
}) {
  const [useUnit, setUseUnit] = useState(person?.offsetMin === undefined);
  const [offset, setOffset] = useState(person?.offsetMin ?? unitOffset);
  const [manualOn, setManualOn] = useState(Boolean(person?.gatherTime));
  const [manual, setManual] = useState(person?.gatherTime ?? "");
  const [note, setNote] = useState(person?.note ?? "");
  const [busy, setBusy] = useState(false);

  const effOffset = useUnit ? unitOffset : offset;
  const auto = firstGame?.start ? timeMinus(firstGame.start, effOffset) : undefined;
  const shown = manualOn && manual ? manual : auto;

  async function save() {
    setBusy(true);
    await onSave({
      offsetMin: useUnit ? null : offset,
      gatherTime: manualOn && manual ? manual : null,
      note: note.trim() ? note.trim() : null,
    });
    setBusy(false);
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2 className="sheet__title">{row.name}さんの集合時間</h2>
          <button type="button" className="sheet__close" onClick={onClose} disabled={busy} aria-label="閉じる">
            ×
          </button>
        </div>

        <p className="person-facts">
          担当：{row.rangeText}（{row.gameCount}試合）　役割：{row.positions}
        </p>

        <div className={`gather-result${shown ? "" : " is-empty"}`}>
          <span className="gather-result__time">{shown ? formatTime(shown) : "--:--"}</span>
          <span className="gather-result__how">
            {manualOn && manual
              ? "手動で設定した時間"
              : firstGame?.start
                ? `第${firstGame.no}試合 ${formatTime(firstGame.start)} の${effOffset}分前`
                : "担当試合の時間が未入力です"}
          </span>
        </div>

        <p className="field__label">何分前に集合？</p>
        <button
          type="button"
          className={`chip-btn chip-btn--wide${useUnit ? " is-active" : ""}`}
          onClick={() => setUseUnit(true)}
        >
          活動全体の設定に合わせる（{unitOffset}分前）
        </button>
        <div className={useUnit ? "is-dim" : ""} onClick={() => setUseUnit(false)}>
          <OffsetPicker value={offset} onChange={setOffset} />
        </div>

        <div className="seg seg--2 manual-toggle">
          <button type="button" className={`seg__btn${!manualOn ? " is-active" : ""}`} onClick={() => setManualOn(false)}>
            自動計算
          </button>
          <button
            type="button"
            className={`seg__btn${manualOn ? " is-active" : ""}`}
            onClick={() => {
              setManualOn(true);
              if (!manual && auto) setManual(auto);
            }}
          >
            手動で決める
          </button>
        </div>
        {manualOn && <TimeField value={manual} onChange={setManual} label="集合時間" baseForAdjust={auto ?? "08:00"} />}

        <label className="field">
          <span className="field__label">備考</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：車で直接向かう" />
        </label>

        <div className="sheet__actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            やめる
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? "保存しています…" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
