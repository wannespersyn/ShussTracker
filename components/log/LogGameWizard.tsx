"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shortNamesFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { pairIntoDuos, pairIntoSolos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer, type TeamPlayer } from "@/lib/teams";
import { logGame } from "@/app/(app)/log/actions";

type FieldHit = "1" | "2" | "3" | "mama" | "miss";
type Mat = "2" | "4" | "8";

type WizardResult = {
  matType: Mat;
  teams: { label: string; playerIds: string[]; finalRank: number }[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
};

const ZONES: { hit: FieldHit; label: string }[] = [
  { hit: "1", label: "1" },
  { hit: "2", label: "2" },
  { hit: "3", label: "3" },
  { hit: "mama", label: "M" },
  { hit: "miss", label: "✕" },
];
const ORD = ["1ST", "2ND", "3RD", "4TH"];
const needFor = (m: Mat) => (m === "8" ? 8 : m === "2" ? 2 : 4);

/** v2 log flow — two screens instead of five:
 *  1. setup: mat + who's playing + teams (tap two names to swap, shuffle, or Chwazi)
 *  2. result: tap teams in finishing order, count mama hits (or every shot when
 *     shot tracking is on), save.
 * Locked teams (tournament match, rematch) and Chwazi presets start on 2. */
export function LogGameWizard({
  groupId,
  roster,
  presetPlayerIds,
  lockedTeams,
  onComplete,
  backHref = "/home",
  trackShotZones = false,
  ratings = {},
}: Readonly<{
  groupId?: string;
  roster: RosterPlayer[];
  presetPlayerIds?: string[];
  lockedTeams?: Duo[];
  onComplete?: (result: WizardResult) => void | Promise<void>;
  backHref?: string;
  /** Crew default for the "track every shot" toggle. */
  trackShotZones?: boolean;
  /** Crew Elo by userId, shown on the player chips. */
  ratings?: Record<string, number>;
}>) {
  const router = useRouter();
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const players = useMemo<TeamPlayer[]>(() => toTeamPlayers(roster), [roster]);
  const shortNames = useMemo(() => shortNamesFor(players), [players]);

  const presetTeams = useMemo<Duo[] | null>(() => {
    if (!presetPlayerIds || presetPlayerIds.length < 2 || presetPlayerIds.length % 2 !== 0) return null;
    const ordered = presetPlayerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is TeamPlayer => Boolean(p));
    if (ordered.length !== presetPlayerIds.length) return null;
    return ordered.length === 2 ? pairIntoSolos(ordered) : pairIntoDuos(ordered);
  }, [presetPlayerIds, players]);

  const initialTeams = lockedTeams ?? presetTeams;
  const initialCount = initialTeams?.reduce((n, x) => n + x.players.length, 0) ?? 0;

  const [step, setStep] = useState<"setup" | "result">(initialTeams ? "result" : "setup");
  const [mat, setMat] = useState<Mat>(initialCount === 2 ? "2" : initialCount === 8 ? "8" : "4");
  const [picked, setPicked] = useState<string[]>(initialTeams ? initialTeams.flatMap((x) => x.players.map((p) => p.id)) : []);
  const [teams, setTeams] = useState<Duo[] | null>(initialTeams);
  const [order, setOrder] = useState<string[]>([]);
  const [zones, setZones] = useState(trackShotZones);
  const [shots, setShots] = useState<Record<string, Partial<Record<FieldHit, number>>>>({});
  const [history, setHistory] = useState<{ playerId: string; hit: FieldHit }[]>([]);

  const need = needFor(mat);
  const tooFew = players.length < need;
  const ready = picked.length === need;

  function pickMat(m: Mat) {
    setMat(m);
    const n = needFor(m);
    setPicked((prev) => (players.length <= n ? players.map((p) => p.id) : prev.slice(0, n)));
    setTeams(null);
  }

  function toggle(id: string) {
    setTeams(null);
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= need ? prev : [...prev, id]));
  }

  const pickedKey = picked.join(",");
  const pickedPlayers = useMemo(() => players.filter((p) => pickedKey.split(",").includes(p.id)), [players, pickedKey]);
  // Fresh random pairing once the roster is complete; edits (swap/shuffle) live in `teams`.
  const autoTeams = useMemo(
    () => (pickedPlayers.length === need ? (mat === "2" ? pairIntoSolos(pickedPlayers) : shuffleIntoDuos(pickedPlayers)) : null),
    [pickedPlayers, need, mat],
  );
  const shownTeams = teams ?? autoTeams;

  function goToResult() {
    if (!shownTeams) return;
    setTeams(shownTeams);
    setOrder([]);
    setStep("result");
  }

  function tapTeam(id: string) {
    if (!teams) return;
    if (teams.length === 2) {
      setOrder([id, teams.find((x) => x.id !== id)!.id]);
      return;
    }
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function bump(playerId: string, hit: FieldHit, delta: number) {
    if (delta > 0) setHistory((h) => [...h, { playerId, hit }]);
    setShots((prev) => {
      const cur = prev[playerId] ?? {};
      return { ...prev, [playerId]: { ...cur, [hit]: Math.max(0, (cur[hit] ?? 0) + delta) } };
    });
  }

  // 8-mat: the last unplaced team is implicitly last once the others are tapped.
  const complete = teams ? order.length >= teams.length - 1 : false;
  const finalOrder = teams && complete ? [...order, ...teams.filter((x) => !order.includes(x.id)).map((x) => x.id)] : order;

  function save() {
    if (!teams || !complete) return;
    const finalTeams = teams.map((x) => ({
      label: x.label,
      playerIds: x.players.map((p) => p.id),
      finalRank: finalOrder.indexOf(x.id) + 1,
    }));
    const shotsByPlayer = Object.entries(shots).flatMap(([playerId, byHit]) =>
      Object.entries(byHit).flatMap(([hit, n]) => Array.from({ length: n ?? 0 }, () => ({ playerId, fieldHit: hit as FieldHit }))),
    );
    startTransition(() => {
      if (onComplete) {
        onComplete({ matType: mat, teams: finalTeams, shotsByPlayer });
        return;
      }
      logGame({ groupId: groupId!, matType: mat, teams: finalTeams, shotsByPlayer });
    });
  }

  function back() {
    if (step === "result" && !lockedTeams) {
      setStep("setup");
      return;
    }
    router.push(backHref);
  }

  const chwaziHref = groupId ? `/chwazi?crewId=${groupId}&count=${need}` : null;
  const winnerTeam = teams?.find((x) => x.id === finalOrder[0]);

  return (
    <div className="min-h-screen bg-surface flex flex-col gap-3.5 px-5 pt-4.5 pb-6 w-full max-w-xl mx-auto">
      <header className="flex items-center justify-between h-11">
        <button
          type="button"
          onClick={back}
          aria-label={t.common.back}
          className="w-11 h-11 rounded-pill bg-surface-panel border border-line text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d={step === "result" && !lockedTeams ? "M15 6l-6 6 6 6" : "M6 6l12 12M18 6L6 18"} />
          </svg>
        </button>
        <span className="font-heading font-extrabold text-[22px] tracking-[0.08em] uppercase">{t.log.title}</span>
        {chwaziHref && step === "setup" ? (
          <Link
            href={chwaziHref}
            className="h-11 px-3 rounded-pill bg-surface-panel border border-line text-cream font-body font-semibold text-[13px] flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
            Chwazi
          </Link>
        ) : (
          <span className="w-11" />
        )}
      </header>

      {step === "setup" && (
        <>
          <div role="group" aria-label={t.log.mat} className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-panel border border-line">
            {(["4", "8", "2"] as Mat[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pickMat(m)}
                aria-pressed={mat === m}
                className={cn(
                  "h-11 rounded-sm font-heading font-bold text-[17px] tracking-[0.04em]",
                  mat === m ? "bg-amber text-ink" : "text-cream/55",
                )}
              >
                {m === "2" ? "1 V 1" : `${m}-MAT`}
              </button>
            ))}
          </div>

          {tooFew ? (
            <p className="font-body text-sm text-red">{format(t.log.tooFew, { have: players.length, need })}</p>
          ) : (
            <>
              <div className="flex justify-between items-baseline">
                <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">{t.log.whoPlays}</span>
                <span className={cn("font-display font-extrabold text-lg", ready ? "text-gold" : "text-cream/55")}>
                  {picked.length} / {need}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {players.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={on}
                      className={cn(
                        "min-h-14 rounded-[14px] px-2 py-1.5 flex flex-col items-center justify-center border-2 text-cream",
                        on ? "bg-surface-raised border-gold" : "bg-surface-deep border-transparent",
                      )}
                    >
                      <span className="font-body font-semibold text-[13px] max-w-full truncate">{shortNames[p.id] ?? p.name}</span>
                      {ratings[p.id] !== undefined && <span className="font-body text-[11px] text-cream/55">{ratings[p.id]}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {shownTeams && mat !== "2" && (
            <div className="flex flex-col gap-2">
              <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">{t.log.teams}</span>
              <DuoPairingBoard players={pickedPlayers} teams={shownTeams} onChange={setTeams} />
            </div>
          )}

          <button
            type="button"
            disabled={!shownTeams}
            onClick={goToResult}
            className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.05em] uppercase disabled:bg-surface-raised disabled:text-cream/40"
          >
            {shownTeams ? t.log.next : format(t.log.pickMore, { n: need - picked.length })}
          </button>
        </>
      )}

      {step === "result" && teams && (
        <>
          <button
            type="button"
            onClick={() => setZones((z) => !z)}
            aria-pressed={zones}
            className="flex items-center gap-3 min-h-12 px-3.5 py-1 rounded-[14px] bg-surface-deep border border-line text-left"
          >
            <span className="flex-1 flex flex-col">
              <span className="font-body font-semibold text-sm">{t.log.trackShots}</span>
              <span className="font-body text-xs text-cream/55">{zones ? t.log.trackOn : t.log.trackOff}</span>
            </span>
            <span className={cn("w-12 h-7 rounded-pill p-0.75 flex", zones ? "bg-amber justify-end" : "bg-surface-raised justify-start")}>
              <span className={cn("w-5.5 h-5.5 rounded-pill", zones ? "bg-ink" : "bg-cream/55")} />
            </span>
          </button>

          <div className="flex items-center justify-between gap-2">
            <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">
              {teams.length > 2 ? t.log.tapOrder : zones ? t.log.tapWinnerShots : t.log.tapWinnerMama}
            </span>
            {zones && history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const last = history[history.length - 1];
                  setHistory((h) => h.slice(0, -1));
                  setShots((prev) => ({ ...prev, [last.playerId]: { ...prev[last.playerId], [last.hit]: Math.max(0, (prev[last.playerId]?.[last.hit] ?? 1) - 1) } }));
                }}
                className="h-8 px-3 rounded-pill bg-surface-panel border border-line font-body font-semibold text-xs text-cream"
              >
                ↺ {t.log.undo}
              </button>
            )}
          </div>

          {teams.map((team) => {
            const r = finalOrder.indexOf(team.id);
            const placed = r > -1 && (order.includes(team.id) || complete);
            return (
              <div
                key={team.id}
                className={cn("rounded-[16px] bg-surface-deep border-2 px-3.5 pt-2 pb-1", placed && r === 0 ? "border-gold" : "border-line")}
              >
                <button type="button" onClick={() => tapTeam(team.id)} className="w-full min-h-11 flex items-center justify-between text-left">
                  <span className="font-heading font-bold text-[19px]">{team.players.map((p) => shortNames[p.id] ?? p.name).join(" & ")}</span>
                  <span
                    className={cn(
                      "font-heading font-extrabold text-[13px] tracking-[0.1em] px-2.5 py-1.5 rounded-sm whitespace-nowrap",
                      placed && r === 0 ? "bg-amber text-ink" : placed ? "bg-cream text-surface" : "bg-surface-raised text-cream/55",
                    )}
                  >
                    {placed ? (teams.length > 2 ? ORD[r] : r === 0 ? t.log.winner : t.log.lost) : teams.length > 2 ? `TAP = ${ORD[order.length]}` : t.log.tapWin}
                  </span>
                </button>
                {team.players.map((p) => {
                  const s = shots[p.id] ?? {};
                  const total = ZONES.reduce((n, z) => n + (s[z.hit] ?? 0), 0);
                  return (
                    <div key={p.id} className="flex flex-col gap-1.5 py-2 border-t border-line">
                      <div className="flex items-center gap-2.5">
                        <span className="flex-1 font-body font-medium text-[15px]">{shortNames[p.id] ?? p.name}</span>
                        {zones ? (
                          <span className="font-body text-xs text-cream/55">
                            {total} {t.log.shots}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => bump(p.id, "mama", -1)}
                              aria-label={t.log.mamaLess}
                              className="w-11 h-9 rounded-sm border border-line bg-surface-raised text-lg font-bold"
                            >
                              −
                            </button>
                            <span className={cn("w-6.5 text-center font-display font-extrabold text-[22px]", (s.mama ?? 0) > 0 ? "text-red" : "text-cream/35")}>
                              {s.mama ?? 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => bump(p.id, "mama", 1)}
                              aria-label={t.log.mamaMore}
                              className="w-11 h-9 rounded-sm border border-red/45 bg-red/15 text-red text-lg font-bold"
                            >
                              +
                            </button>
                          </span>
                        )}
                      </div>
                      {zones && (
                        <div className="grid grid-cols-5 gap-1">
                          {ZONES.map((z) => {
                            const n = s[z.hit] ?? 0;
                            return (
                              <button
                                key={z.hit}
                                type="button"
                                onClick={() => bump(p.id, z.hit, 1)}
                                aria-label={`${z.label} — ${shortNames[p.id] ?? p.name}`}
                                className={cn(
                                  "h-11 rounded-sm flex flex-col items-center justify-center leading-none",
                                  n > 0
                                    ? z.hit === "mama"
                                      ? "bg-red text-ink"
                                      : z.hit === "miss"
                                        ? "bg-cream/40 text-ink"
                                        : "bg-cream text-surface"
                                    : cn("bg-surface-raised border border-line", z.hit === "mama" ? "text-red" : "text-cream/75"),
                                )}
                              >
                                <span className="font-display font-extrabold text-[15px]">{z.label}</span>
                                <span className="font-body font-bold text-[11px]">{n}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          <button
            type="button"
            disabled={!complete || isPending}
            onClick={save}
            className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-[19px] tracking-[0.05em] uppercase disabled:bg-surface-raised disabled:text-cream/40"
          >
            {isPending
              ? t.log.saving
              : complete && winnerTeam
                ? format(t.log.save, { name: winnerTeam.players.map((p) => shortNames[p.id] ?? p.name).join(" & ").toUpperCase() })
                : teams.length > 2
                  ? t.log.setOrder
                  : t.log.pickWinner}
          </button>
        </>
      )}
    </div>
  );
}
