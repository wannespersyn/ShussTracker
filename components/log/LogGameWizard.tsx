"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shortNamesFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { balanceIntoDuos, pairIntoDuos, pairIntoSolos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer, type TeamPlayer } from "@/lib/teams";
import { logGame } from "@/app/(app)/log/actions";
import { Avatar } from "@/components/v2";
import { MatLogger } from "@/components/log/MatLogger";
import { BetaPill } from "@/components/beta/BetaUi";
import { ZONES, type MatGameLog } from "@/lib/mat";
import { WhoStarts } from "@/components/beta/WhoStarts";
import { TeamFingers } from "@/components/beta/TeamFingers";
import { MamaShot } from "@/components/beta/MamaShot";
import { TeamDraw } from "@/components/beta/TeamDraw";

type FieldHit = "1" | "2" | "3" | "mama" | "miss";
type Mat = "2" | "4" | "8";

type WizardResult = {
  matType: Mat;
  teams: { label: string; playerIds: string[]; finalRank: number }[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
  mat?: MatGameLog;
};

/** Classic `shot` rows from a mat log: one per real throw, at the spot the
 * thrown cap first landed — so Elo, recaps and zone stats keep working. */
function shotsFromMat(log: MatGameLog): { playerId: string; fieldHit: FieldHit }[] {
  return log.rounds.flatMap((r) =>
    r.throws
      .filter((t) => t.kind !== "skipped")
      .map((t) => {
        const spot = t.moves.find((m) => m.isThrownCap)?.toSpot ?? "miss";
        const z = ZONES.find((x) => x.id === spot);
        const fieldHit: FieldHit = z ? (String(z.v) as FieldHit) : spot === "ML" || spot === "MR" ? "mama" : "miss";
        return { playerId: t.playerId, fieldHit };
      }),
  );
}
const needFor = (m: Mat) => (m === "8" ? 8 : m === "2" ? 2 : 4);

/** Log flow, one decision per screen:
 *  1. players: mat + who's playing
 *  2. teams: tap two names to swap, shuffle, balance by Elo or Chwazi (beta)
 *  3. start: beta users pick who starts (cap toss, Chwazi) and the 3-2-1,
 *     and can switch on the mat logger (beta, 1v1 / 2v2)
 *  4. play: the full-screen mat logger, which ends the game itself
 *  5. result: tap teams in finishing order + mama counts, save.
 * 1v1 skips the teams step. Locked teams (tournament match, rematch) and
 * presets start on 3. */
type Step = "players" | "teams" | "start" | "play" | "result";
export function LogGameWizard({
  groupId,
  roster,
  presetPlayerIds,
  lockedTeams,
  onComplete,
  backHref = "/home",
  ratings = {},
  duoRecords = {},
  crewName,
  beta,
}: Readonly<{
  groupId?: string;
  roster: RosterPlayer[];
  presetPlayerIds?: string[];
  lockedTeams?: Duo[];
  onComplete?: (result: WizardResult) => void | Promise<void>;
  backHref?: string;
  /** Crew Elo by userId, shown on the player chips. */
  ratings?: Record<string, number>;
  /** "W–L" per duo, keyed by the two sorted user ids joined with "|". */
  duoRecords?: Record<string, string>;
  crewName?: string;
  /** Beta features switched on for the logging user (Settings › Beta). */
  beta?: { start?: boolean; celebrations?: boolean; mat?: boolean };
}>) {
  const router = useRouter();
  const { t } = useT();
  const ORD = [t.more.ord1, t.more.ord2, t.more.ord3, t.more.ord4];
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

  const [step, setStep] = useState<Step>(initialTeams ? "start" : "players");
  const [, setStartedWith] = useState<string | null>(null);
  const [mat, setMat] = useState<Mat>(initialCount === 2 ? "2" : initialCount === 8 ? "8" : "4");
  const [picked, setPicked] = useState<string[]>(initialTeams ? initialTeams.flatMap((x) => x.players.map((p) => p.id)) : []);
  const [teams, setTeams] = useState<Duo[] | null>(initialTeams);
  const [order, setOrder] = useState<string[]>([]);
  const [useMat, setUseMat] = useState(Boolean(beta?.mat));
  const [shots, setShots] = useState<Record<string, Partial<Record<string, number>>>>({});
  const [fingers, setFingers] = useState(false);
  const [draw, setDraw] = useState<{ teams: Duo[]; mode: "random" | "balanced"; k: number } | null>(null);
  const [mama, setMama] = useState<{ name: string; team: number; k: number } | null>(null);
  const closeMama = useCallback(() => setMama(null), []);

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

  /** Shuffle or Elo-balance the picked players; beta users with two teams
   * get the full-screen draw animation. */
  function drawTeams(mode: "random" | "balanced") {
    const next = mode === "balanced" ? balanceIntoDuos(pickedPlayers, ratings) : shuffleIntoDuos(pickedPlayers);
    setTeams(next);
    if (beta?.start && next.length === 2) setDraw({ teams: next, mode, k: Date.now() });
  }

  // The mat logger handles two teams of one or two (no 8-mat yet).
  const matOk = Boolean(beta?.mat) && mat !== "8";
  const playMat = matOk && useMat;
  const flow: Step[] = [
    ...(lockedTeams ? [] : (["players"] as Step[])),
    ...(lockedTeams || mat === "2" ? [] : (["teams"] as Step[])),
    "start",
    ...(playMat ? (["play"] as Step[]) : (["result"] as Step[])),
  ];
  const stepLabel: Record<Step, string> = {
    players: t.log.stepPlayers,
    teams: t.log.stepTeams,
    start: t.log.stepStart,
    play: t.log.stepPlay,
    result: t.log.stepResult,
  };

  function next() {
    const to = flow[flow.indexOf(step) + 1];
    if (!to) return;
    if (step === "players" || step === "teams") {
      if (!shownTeams) return;
      setTeams(shownTeams);
      setOrder([]);
    }
    setStep(to);
    window.scrollTo({ top: 0 });
  }

  const onStarted = useCallback(
    (summary: string) => {
      setStartedWith(summary);
      setStep(playMat ? "play" : "result");
      window.scrollTo({ top: 0 });
    },
    [playMat],
  );

  function tapTeam(id: string) {
    if (!teams) return;
    if (teams.length === 2) {
      setOrder([id, teams.find((x) => x.id !== id)!.id]);
      return;
    }
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** Beta: the mat's mama animation when someone logs a mama. */
  function celebrateMama(playerId: string) {
    if (!beta?.celebrations || !teams) return;
    const name = shortNames[playerId] ?? players.find((p) => p.id === playerId)?.name ?? "";
    setMama({ name, team: Math.max(0, teams.findIndex((x) => x.players.some((p) => p.id === playerId))), k: Date.now() });
  }

  function bump(playerId: string, hit: string, delta: number) {
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
      Array.from({ length: byHit.mama ?? 0 }, () => ({ playerId, fieldHit: "mama" as FieldHit })),
    );
    startTransition(() => {
      if (onComplete) {
        onComplete({ matType: mat, teams: finalTeams, shotsByPlayer });
        return;
      }
      logGame({ groupId: groupId!, matType: mat, teams: finalTeams, shotsByPlayer });
    });
  }

  /** Mat logger finished (a team emptied its pints): that team wins. */
  function saveMat(log: MatGameLog) {
    if (!teams) return;
    const finalTeams = teams.map((x, i) => ({ label: x.label, playerIds: x.players.map((p) => p.id), finalRank: i === log.winnerTeam ? 1 : 2 }));
    const result = { matType: mat, teams: finalTeams, shotsByPlayer: shotsFromMat(log), mat: log };
    startTransition(() => {
      if (onComplete) {
        onComplete(result);
        return;
      }
      logGame({ groupId: groupId!, ...result });
    });
  }

  function back() {
    const i = flow.indexOf(step);
    if (i > 0) {
      setStep(flow[i - 1]);
      return;
    }
    router.push(backHref);
  }

  const winnerTeam = teams?.find((x) => x.id === finalOrder[0]);

  const matToggle = matOk ? (
    <button
      type="button"
      onClick={() => setUseMat((v) => !v)}
      aria-pressed={useMat}
      className="flex items-center gap-3 min-h-12 px-3.5 py-1 rounded-[14px] bg-surface-deep border border-line text-left text-cream"
    >
      <span className="flex-1 flex flex-col">
        <span className="flex items-center gap-2 font-body font-semibold text-sm">
          {t.mat.useMat}
          <BetaPill>{t.beta.pill}</BetaPill>
        </span>
        <span className="font-body text-xs text-muted">{t.mat.useMatSub}</span>
      </span>
      <span className={cn("w-12 h-7 rounded-pill p-0.75 flex", useMat ? "bg-amber justify-end" : "bg-chip justify-start")}>
        <span className={cn("w-5.5 h-5.5 rounded-pill", useMat ? "bg-ink" : "bg-muted")} />
      </span>
    </button>
  ) : null;

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
            <path d={flow.indexOf(step) > 0 ? "M15 6l-6 6 6 6" : "M6 6l12 12M18 6L6 18"} />
          </svg>
        </button>
        <span className="font-heading font-extrabold text-[22px] tracking-[0.08em] uppercase">{t.log.title}</span>
        <span className="w-11" />
      </header>

      <ol className="flex gap-1.5" aria-label={t.log.title}>
        {flow.map((f, i) => {
          const at = flow.indexOf(step);
          return (
            <li key={f} aria-current={f === step ? "step" : undefined} className="flex-1 flex flex-col gap-1">
              <span className={cn("h-1 rounded-pill", i <= at ? "bg-amber" : "bg-chip")} />
              <span className={cn("font-heading font-bold text-[11px] tracking-[0.08em] uppercase", f === step ? "text-cream" : "text-muted")}>{stepLabel[f]}</span>
            </li>
          );
        })}
      </ol>

      {step === "players" && (
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
                  mat === m ? "bg-amber text-ink" : "text-muted",
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
                <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">{t.log.whoPlays}</span>
                <span className={cn("font-display font-extrabold text-lg", ready ? "text-gold" : "text-muted")}>
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
                      {ratings[p.id] !== undefined && <span className="font-body text-[11px] text-muted">{ratings[p.id]}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <button
            type="button"
            disabled={!shownTeams}
            onClick={next}
            className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.05em] uppercase disabled:bg-surface-raised disabled:text-muted"
          >
            {shownTeams ? (mat === "2" ? t.log.nextStart : t.log.nextTeams) : format(t.log.pickMore, { n: need - picked.length })}
          </button>
        </>
      )}

      {step === "teams" && shownTeams && (
        <>
          <div className="flex flex-col gap-2">
            <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">{t.log.teams}</span>
            <DuoPairingBoard players={pickedPlayers} teams={shownTeams} onChange={setTeams} hideShuffle />
            <div className={cn("grid gap-2", beta?.start ? "grid-cols-3" : "grid-cols-2")}>
              <button type="button" onClick={() => drawTeams("random")} className="h-11 rounded-md border border-dashed border-cream/25 font-heading font-bold text-sm tracking-[0.08em] uppercase text-soft">
                ↻ {t.log.teamShuffle}
              </button>
              <button type="button" onClick={() => drawTeams("balanced")} className="h-11 rounded-md border border-dashed border-cream/25 font-heading font-bold text-sm tracking-[0.08em] uppercase text-soft">
                ⚖ {t.log.teamBalance}
              </button>
              {beta?.start && (
                <button type="button" onClick={() => setFingers(true)} className="h-11 rounded-md flex items-center justify-center gap-1.5 font-heading font-bold text-sm tracking-[0.08em] uppercase" style={{ backgroundColor: "#ffb627", color: "#111" }}>
                  ✋ Chwazi
                </button>
              )}
            </div>
          </div>
          {draw && draw.teams.length === 2 && (
            <TeamDraw
              key={draw.k}
              teamA={draw.teams[0].players.map((p) => shortNames[p.id] ?? p.name)}
              teamB={draw.teams[1].players.map((p) => shortNames[p.id] ?? p.name)}
              sub={draw.mode === "balanced" ? t.chwazi.balanced : t.chwazi.luck}
              onAgain={() => drawTeams(draw.mode)}
              onClose={() => setDraw(null)}
              doneLabel={t.beta.start.useTeams}
              onDone={() => setDraw(null)}
            />
          )}
          {fingers && (
            <TeamFingers
              players={pickedPlayers.map((p) => ({ id: p.id, name: shortNames[p.id] ?? p.name }))}
              onClose={() => setFingers(false)}
              doneLabel={t.beta.start.useTeams}
              onDone={(ids) => {
                setTeams(pairIntoDuos(ids.map((id) => pickedPlayers.find((p) => p.id === id)!)));
                setFingers(false);
              }}
            />
          )}

          <button
            type="button"
            onClick={next}
            className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.05em] uppercase"
          >
            {t.log.nextStart}
          </button>
        </>
      )}

      {mama && <MamaShot key={mama.k} name={mama.name} team={mama.team} onDone={closeMama} />}

      {step === "start" && teams && (
        <>
          <div className="flex items-center gap-2.5 rounded-[16px] bg-surface-deep border border-line px-3.5 py-3">
            {teams.map((team, i) => (
              <span key={team.id} className="contents">
                {i > 0 && <span className="font-display font-extrabold text-lg text-muted">VS</span>}
                <span className={cn("flex-1 min-w-0 font-heading font-bold text-[17px] leading-tight", i > 0 && "text-right")}>
                  {team.players.map((p) => shortNames[p.id] ?? p.name).join(" & ")}
                </span>
              </span>
            ))}
          </div>
          {beta?.start ? (
            <WhoStarts teams={teams} nameOf={(id, name) => shortNames[id] ?? name} onStarted={onStarted}>
              {matToggle}
            </WhoStarts>
          ) : (
            <>
            {matToggle}
              <button
                type="button"
                onClick={() => onStarted("")}
                className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.05em] uppercase"
              >
                {playMat ? t.beta.start.startGame : t.log.nextResult}
              </button>
            </>
          )}
        </>
      )}

      {step === "play" && teams && (
        <MatLogger
          teams={teams}
          names={Object.fromEntries(teams.flatMap((x) => x.players).map((p) => [p.id, shortNames[p.id] ?? p.name]))}
          saving={isPending}
          onSave={saveMat}
          onClose={() => setStep("start")}
        />
      )}

      {step === "result" && teams && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">
              {teams.length > 2 ? t.log.tapOrder : t.log.tapWinnerMama}
            </span>
          </div>

          {teams.map((team) => {
            const r = finalOrder.indexOf(team.id);
            const placed = r > -1 && (order.includes(team.id) || complete);
            return (
              <div
                key={team.id}
                className={cn("rounded-[16px] bg-surface-deep border-2 px-3.5 pt-2 pb-1", placed && r === 0 ? "border-gold" : "border-line")}
              >
                <button type="button" onClick={() => tapTeam(team.id)} className="w-full min-h-11 flex items-center justify-between text-left text-cream">
                  <span className="flex flex-col">
                    <span className="font-heading font-bold text-[19px]">{team.players.map((p) => shortNames[p.id] ?? p.name).join(" & ")}</span>
                    {team.players.length === 2 && duoRecords[team.players.map((p) => p.id).sort().join("|")] && (
                      <span className="font-body text-xs text-muted">
                        {format(t.log.together, { r: duoRecords[team.players.map((p) => p.id).sort().join("|")] })}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-heading font-extrabold text-[13px] tracking-[0.1em] px-2.5 py-1.5 rounded-sm whitespace-nowrap",
                      placed && r === 0 ? "bg-amber text-ink" : placed ? "bg-cream text-surface" : "bg-surface-raised text-muted",
                    )}
                  >
                    {placed ? (teams.length > 2 ? ORD[r] : r === 0 ? t.log.winner : t.log.lost) : teams.length > 2 ? format(t.more.tapOrd, { o: ORD[order.length] }) : t.log.tapWin}
                  </span>
                </button>
                {team.players.map((p) => {
                  const s = shots[p.id] ?? {};
                  return (
                    <div key={p.id} className="flex flex-col gap-1.5 py-2 border-t border-cream/6">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p.name} size={28} fontSize={11} />
                        <span className="flex-1 font-body font-medium text-[15px]">{shortNames[p.id] ?? p.name}</span>
                          <span className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => bump(p.id, "mama", -1)}
                              aria-label={t.log.mamaLess}
                              className="w-11 h-9 rounded-[10px] border border-line-strong bg-surface-raised text-cream text-lg font-bold"
                            >
                              −
                            </button>
                            <span className={cn("w-6.5 text-center font-display font-extrabold text-[22px]", (s.mama ?? 0) > 0 ? "text-red" : "text-[#5b6460]")}>
                              {s.mama ?? 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                bump(p.id, "mama", 1);
                                celebrateMama(p.id);
                              }}
                              aria-label={t.log.mamaMore}
                              className="w-11 h-9 rounded-[10px] border border-red/40 bg-red/13 text-red-pale text-lg font-bold"
                            >
                              +
                            </button>
                          </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {crewName && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-surface-deep border border-dashed border-cream/14 font-body text-[13px] text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {format(t.log.countsFor, { time: nowLabel(), crew: crewName })}
            </div>
          )}

          <button
            type="button"
            disabled={!complete || isPending}
            onClick={save}
            className="h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-[19px] tracking-[0.05em] uppercase disabled:bg-surface-raised disabled:text-muted"
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

function nowLabel() {
  return new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}
