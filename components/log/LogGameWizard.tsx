"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { capRingGradient, capRingPairs, type CapRingColor } from "@/lib/theme/tokens";
import { shortNamesFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BackButton, LinkButton, PrimaryButton } from "@/components/ui";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { pairIntoDuos, pairIntoSolos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer, type TeamPlayer } from "@/lib/teams";
import { logGame } from "@/app/(app)/log/actions";

const FIELD_HITS = ["3", "2", "1", "mama", "miss"] as const;
type FieldHit = (typeof FIELD_HITS)[number];

type FlyingCap = { id: number; left: string; top: string };

// Titles by wizard step (0-4). The 2-player mat skips step 2 ("Set the
// duos" — nothing to pair with just two players) and renumbers the
// kicker accordingly; see `copy` below.
const STEP_TITLES = ["Pick your mat", "Choose players", "Set the duos", "Flick 'em", "Who won"];

type WizardResult = {
  matType: "2" | "4" | "8";
  teams: { label: string; playerIds: string[]; finalRank: number }[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
};

export function LogGameWizard({
  groupId,
  eventId,
  roster,
  presetPlayerIds,
  lockedTeams,
  onComplete,
  backHref = "/home",
  trackShotZones = false,
}: Readonly<{
  groupId?: string;
  eventId?: string;
  roster: RosterPlayer[];
  presetPlayerIds?: string[];
  /** Fixed, non-swappable teams (tournament match play) — skips mat-size
   * picking and duo pairing entirely, starting right at shot logging.
   * Always exactly 2 teams (a bracket match). */
  lockedTeams?: Duo[];
  /** Called with the finished result instead of the built-in `logGame`
   * call — lets tournament match play record the result against its own
   * bracket bookkeeping instead of a plain casual game. */
  onComplete?: (result: WizardResult) => void | Promise<void>;
  backHref?: string;
  /** The crew's `trackShotZones` setting — off by default. When off, the
   * mat collapses NEAR/MID/FAR into a single HIT tap (logged as "1") since
   * most crews never actually track which field a cap landed in. */
  trackShotZones?: boolean;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const players = useMemo<TeamPlayer[]>(() => toTeamPlayers(roster), [roster]);
  const shortNames = useMemo(() => shortNamesFor(players), [players]);

  // A duo pairing decided elsewhere (Chwazi) and handed off via query
  // param — skips straight to the duo-review step instead of re-picking a
  // mat and shuffling fresh.
  const presetTeams = useMemo<Duo[] | null>(() => {
    if (!presetPlayerIds || presetPlayerIds.length < 4 || presetPlayerIds.length % 2 !== 0) return null;
    const ordered = presetPlayerIds
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is TeamPlayer => Boolean(p));
    return ordered.length === presetPlayerIds.length ? pairIntoDuos(ordered) : null;
  }, [presetPlayerIds, players]);

  const initialTeams = lockedTeams ?? presetTeams;
  // Total player count uniquely determines mat size (2 solos, 2 duos, or 4
  // duos) — `initialTeams.length` alone can't tell a 2-player head-to-head
  // (2 teams of 1) apart from a 4-player mat (2 teams of 2).
  const initialPlayerCount = initialTeams?.reduce((n, t) => n + t.players.length, 0) ?? 0;

  const [step, setStep] = useState(initialTeams ? 2 : 0);
  const [matType, setMatType] = useState<"2" | "4" | "8" | null>(
    initialPlayerCount === 2 ? "2" : initialPlayerCount === 8 ? "8" : initialPlayerCount === 4 ? "4" : null,
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    initialTeams ? initialTeams.flatMap((t) => t.players.map((p) => p.id)) : [],
  );
  const [teams, setTeams] = useState<Duo[] | null>(initialTeams);
  const [activeShooterId, setActiveShooterId] = useState<string | null>(
    lockedTeams ? (lockedTeams[0]?.players[0]?.id ?? null) : null,
  );
  const [shotLog, setShotLog] = useState<{ playerId: string; fieldHit: FieldHit }[]>([]);
  const [flyingCaps, setFlyingCaps] = useState<FlyingCap[]>([]);
  const [winnerTeamId, setWinnerTeamId] = useState<string | null>(null);

  const gamePlayers = teams?.flatMap((t) => t.players) ?? [];
  const needed = matType === "8" ? 8 : matType === "2" ? 2 : 4;
  const notEnoughPlayers = matType !== null && players.length < needed;
  const eventQuery = eventId ? `&eventId=${eventId}` : "";
  // Only offered once a mat size is picked (so Chwazi knows how many
  // players to draw) and only for duo mats — a 2-player mat is head-to-head
  // with no team to decide, so there's nothing for Chwazi to pick.
  const chwaziHref = matType && matType !== "2" ? `/chwazi?crewId=${groupId}${eventQuery}&count=${needed}` : null;

  function pickMat(type: "2" | "4" | "8") {
    setMatType(type);
    const need = type === "8" ? 8 : type === "2" ? 2 : 4;
    // A roster that exactly fills the mat needs no picking; a bigger crew
    // (e.g. 7 members for a 4-player mat) has to say who's actually playing.
    setSelectedPlayerIds(players.length <= need ? players.map((p) => p.id) : []);
  }

  function togglePlayerSelection(playerId: string) {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= needed) return prev;
      return [...prev, playerId];
    });
  }

  function logShot(fieldHit: FieldHit) {
    if (!activeShooterId) return;
    const id = Date.now() + Math.random();
    setFlyingCaps((prev) => [
      ...prev,
      { id, left: `${40 + Math.random() * 20}%`, top: `${55 + Math.random() * 15}%` },
    ]);
    setTimeout(() => setFlyingCaps((prev) => prev.filter((c) => c.id !== id)), 520);
    setShotLog((prev) => [...prev, { playerId: activeShooterId, fieldHit }]);
  }

  function undoShot() {
    setShotLog((prev) => prev.slice(0, -1));
  }

  function tapWinner(teamId: string) {
    setWinnerTeamId(teamId);
  }

  const canAdvance =
    (step === 0 && matType !== null && !notEnoughPlayers) ||
    (step === 1 && selectedPlayerIds.length === needed) ||
    (step === 2 && teams !== null) ||
    step === 3 ||
    (step === 4 && winnerTeamId !== null);

  function next() {
    if (step < 4) {
      // Duos are shuffled once the player picks are final (leaving step 1,
      // not step 0 — `selectedPlayerIds` isn't settled until then for
      // rosters bigger than the mat). The shooter is picked once duos are
      // final too, so a swap made on the pairing board (step 2) is honored.
      if (step === 1) {
        const picked = players.filter((p) => selectedPlayerIds.includes(p.id));
        // A 2-player mat has nobody to pair up — skip straight past the
        // duo-pairing step to shot logging.
        if (matType === "2") {
          const solo = pairIntoSolos(picked);
          setTeams(solo);
          setActiveShooterId(solo[0]?.players[0]?.id ?? null);
          setStep(3);
          return;
        }
        // Honor a Chwazi-decided pairing (skill-balanced or otherwise) as
        // long as the player selection hasn't changed since — only reshuffle
        // fresh when there's no preset or the picks have actually moved.
        const pickedIds = new Set(picked.map((p) => p.id));
        const presetStillValid =
          presetTeams !== null &&
          presetTeams.reduce((n, t) => n + t.players.length, 0) === picked.length &&
          presetTeams.every((t) => t.players.every((p) => pickedIds.has(p.id)));
        setTeams(presetStillValid ? presetTeams : shuffleIntoDuos(picked));
      }
      if (step === 2) setActiveShooterId(teams?.[0]?.players[0]?.id ?? null);
      setStep((s) => s + 1);
      return;
    }
    // Final step (4, "Who won") — submit.
    if (!teams) return;
    const finalTeams = teams.map((t) => ({
      label: t.label,
      playerIds: t.players.map((p) => p.id),
      finalRank: t.id === winnerTeamId ? 1 : 2,
    }));

    startTransition(() => {
      if (onComplete) {
        onComplete({ matType: matType!, teams: finalTeams, shotsByPlayer: shotLog });
        return;
      }
      logGame({
        groupId: groupId!,
        eventId,
        matType: matType!,
        teams: finalTeams,
        shotsByPlayer: shotLog,
      });
    });
  }

  function back() {
    const minStep = lockedTeams ? 2 : 0;
    if (step === minStep) {
      router.push(backHref);
      return;
    }
    // Mirror the forward skip: a 2-player mat jumps straight from picking
    // players (step 1) to shot logging (step 3), so backing out of shot
    // logging returns to step 1, not the pairing step it never visited.
    if (matType === "2" && step === 3) {
      setStep(1);
      return;
    }
    setStep((s) => s - 1);
  }

  // Zones off: collapse the near/mid/far tally into a single HIT count
  // (all logged as "1") — the crew never distinguishes them, so a 3/2/1
  // breakdown here would just show two columns permanently stuck at zero.
  const tallyFieldHits: FieldHit[] = trackShotZones ? [...FIELD_HITS] : ["1", "mama", "miss"];
  const tally = tallyFieldHits.map((fh) => ({
    fieldHit: fh,
    label: fh === "mama" ? "RISK" : fh === "miss" ? "MISS" : trackShotZones ? fh : "HIT",
    n: shotLog.filter((s) => s.fieldHit === fh).length,
    color: fh === "mama" ? "var(--color-red-bright)" : fh === "miss" ? "rgba(239,231,214,.4)" : "var(--color-cream)",
  }));

  // The 2-player mat skips step 2 entirely, so it only ever visits 4 of
  // the 5 steps — renumber the kicker and progress dots to match instead
  // of showing a phantom "step 3".
  const totalSteps = matType === "2" ? 4 : 5;
  const displayStep = matType === "2" && step >= 3 ? step - 1 : step;
  const copy =
    lockedTeams && step === 2
      ? { kicker: "Tournament match", title: `${lockedTeams[0].label} vs ${lockedTeams[1].label}` }
      : { kicker: `Step ${displayStep + 1} of ${totalSteps}`, title: STEP_TITLES[step] };
  const dots = (matType === "2" ? [1, 3, 4] : [1, 2, 3, 4]).map((i) => (step >= i ? "bg-gold" : "bg-cream/15"));

  return (
    <div className="relative min-h-screen bg-surface flex flex-col pt-16.5 pb-2">
      <div className="px-5 flex items-center gap-3.5">
        <BackButton onClick={back} />
        <div className="flex-1">
          <div className="font-heading font-semibold text-[13px] tracking-[1.8px] uppercase text-cream/45">
            {copy.kicker}
          </div>
          <div className="font-display text-display-sm tracking-[0.6px] text-cream">{copy.title}</div>
        </div>
      </div>

      <div className="flex gap-1.25 px-5 w-full mt-4">
        <div className="w-full h-1.25 rounded-[3px] bg-gold" />
        {dots.map((c, i) => (
          <div key={i} className={cn("w-full h-1.25 rounded-[3px]", c)} />
        ))}
      </div>

      {step === 0 && (
        <div className="flex-1 px-5 py-6.5 flex flex-col gap-4">
          <MatTile
            label="2 PLAYERS"
            sub="Just the two of you, head to head."
            dots={["gold", "mint"]}
            selected={matType === "2"}
            onClick={() => pickMat("2")}
          />
          <MatTile
            label="4 PLAYERS"
            sub="One mat, two duos, quick round."
            dots={["gold", "gold", "cream", "cream"]}
            selected={matType === "4"}
            onClick={() => pickMat("4")}
          />
          <MatTile
            label="8 PLAYERS"
            sub="Four duos, one mat, one winner."
            dots={["red", "red", "gold", "gold", "cream", "cream", "mint", "mint"]}
            selected={matType === "8"}
            onClick={() => pickMat("8")}
          />
          {notEnoughPlayers && (
            <div className="text-center font-body text-body-sm text-red-pale">
              Your crew only has {players.length} — need {needed} for this mat.
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 px-5 py-6.5 flex flex-col gap-4">
          {matType !== null && !notEnoughPlayers && players.length > needed && (
            <div className="flex flex-col gap-2.5">
              <div className="font-body text-body-sm text-cream/55">
                Who&apos;s playing tonight? Pick {needed} ({selectedPlayerIds.length}/{needed})
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => {
                  const picked = selectedPlayerIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlayerSelection(p.id)}
                      className={cn(
                        "px-4 h-11 rounded-md font-heading font-bold text-sm",
                        picked ? "bg-gold text-ink" : "bg-cream/8 text-cream/70",
                      )}
                    >
                      {shortNames[p.id] ?? p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {chwaziHref && (
            <LinkButton href={chwaziHref} variant="outline" className="mt-auto">
              Let Chwazi pick teams instead
            </LinkButton>
          )}
        </div>
      )}

      {}

      {step === 2 && teams && (
        <div className="flex-1 px-5 pt-5.5 flex flex-col gap-3.5 overflow-auto">
          <div className="flex flex-col items-baseline gap-2">
            <div className="font-heading font-bold text-[12px] tracking-[1.6px] uppercase text-gold">
              {matType}-PLAYER MAT
            </div>
            <div className="flex-1 font-body text-sm text-cream/55">
              Tap two names to swap. Nobody&apos;s stuck with their partner.
            </div>
          </div>
          <DuoPairingBoard players={gamePlayers} teams={teams} onChange={setTeams} />
        </div>
      )}

      {step === 3 && teams && (
        <div className="flex-1 px-5 pt-4 flex flex-col relative">
          <div className="flex flex-wrap gap-2 mb-3.5">
            {gamePlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveShooterId(p.id)}
                className={cn(
                  "flex-1 min-w-19 h-11 rounded-md font-heading font-bold text-sm tracking-[0.6px]",
                  activeShooterId === p.id ? "bg-gold text-ink" : "bg-cream/8 text-cream/70",
                )}
              >
                {shortNames[p.id] ?? p.name}
              </button>
            ))}
          </div>

          <div className="relative rounded-xl overflow-hidden bg-[linear-gradient(#F8F2E0,#E7DCBF)] border-4 border-surface-deep h-88 shadow-elevation-lg">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(11,38,32,.05) 0 3px, transparent 3px 7px)" }}
            />

            {/* Mat lane: a funnel of pockets narrowing from NEAR (wide, closest
                to the flick) up to FAR (narrow, hardest) — a shuffleboard lane,
                not a dartboard bullseye. Zones off collapses the three
                pockets into one HIT tap, since the crew never tracks which
                field a cap actually landed in. */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              {trackShotZones ? (
                <>
                  <polygon
                    points="8,98 92,98 82,77 18,77"
                    className="fill-field-near cursor-pointer"
                    onClick={() => logShot("1")}
                  />
                  <polygon
                    points="21,71 79,71 71,51 29,51"
                    className="fill-field-mid cursor-pointer"
                    onClick={() => logShot("2")}
                  />
                  <polygon
                    points="31,45 69,45 60,22 40,22"
                    className="fill-field-far cursor-pointer"
                    onClick={() => logShot("3")}
                  />
                  <g className="pointer-events-none">
                    <text x="50" y="90" textAnchor="middle" fontSize="5" className="font-heading font-bold fill-cream/70" style={{ letterSpacing: "0.06em" }}>
                      NEAR · 1
                    </text>
                    <text x="50" y="64" textAnchor="middle" fontSize="5" className="font-heading font-bold fill-cream/75" style={{ letterSpacing: "0.06em" }}>
                      MID · 2
                    </text>
                    <text x="50" y="37" textAnchor="middle" fontSize="4.3" className="font-heading font-bold fill-cream/80" style={{ letterSpacing: "0.06em" }}>
                      FAR · 3
                    </text>
                  </g>
                </>
              ) : (
                <>
                  <polygon
                    points="8,98 92,98 60,22 40,22"
                    className="fill-field-near cursor-pointer"
                    onClick={() => logShot("1")}
                  />
                  <g className="pointer-events-none">
                    <text x="50" y="64" textAnchor="middle" fontSize="6" className="font-heading font-bold fill-cream/75" style={{ letterSpacing: "0.06em" }}>
                      HIT
                    </text>
                  </g>
                </>
              )}
            </svg>

            <div
              className="absolute w-8.5 h-8.5 rounded-pill -rotate-22 pointer-events-none shadow-elevation-sm"
              style={{ right: "13%", top: "58%", background: capRingGradient("cream") }}
            />
            <div
              className="absolute w-9 h-9 rounded-pill rotate-34 pointer-events-none shadow-elevation-sm"
              style={{ left: "12%", bottom: "10%", background: capRingGradient("red") }}
            />

            <button
              type="button"
              onClick={() => logShot("mama")}
              className="absolute left-1/2 top-2.5 -translate-x-1/2 w-[86%] h-13.5 rounded-md bg-red border-4 border-cream flex flex-col items-center justify-center animate-glow"
            >
              <div className="font-display text-lg text-white leading-none">RISK</div>
              <div className="font-heading font-bold text-[10px] tracking-[1.2px] text-white/85 mt-0.5">THEY CHUG</div>
            </button>
            {flyingCaps.map((c) => (
              <div
                key={c.id}
                className="absolute w-10 h-10 rounded-pill animate-fly pointer-events-none shadow-elevation-sm"
                style={{ left: c.left, top: c.top, background: capRingGradient("gold") }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => logShot("miss")}
            className="mt-3 h-14.5 rounded-md bg-cream/7 border-2 border-cream/14 flex items-center justify-center font-display text-xl tracking-[1px] text-cream/60"
          >
            MISS
          </button>

          <div className="mt-3.5 flex items-center gap-2">
            {tally.map((t) => (
              <div key={t.fieldHit} className="flex-1 text-center py-2 rounded-md bg-cream/5">
                <div className="font-mono font-semibold text-[22px]" style={{ color: t.color }}>
                  {t.n}
                </div>
                <div className="font-heading font-semibold text-[11px] tracking-[1.2px] text-cream/45 uppercase">
                  {t.label}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={undoShot}
              className="w-13 h-13 rounded-md bg-cream/8 flex items-center justify-center text-cream text-lg"
            >
              ↺
            </button>
          </div>
        </div>
      )}

      {step === 4 && teams && (
        <div className="flex-1 px-5 pt-5.5 flex flex-col gap-3 overflow-auto">
          <div className="font-body text-[14.5px] text-cream/55">
            {matType === "2" ? "Tap the winner." : "Tap the winning duo."}
          </div>
          {teams.map((t) => {
            const rank = t.id === winnerTeamId ? 1 : winnerTeamId ? 2 : null;
            const isWinner = rank === 1;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => tapWinner(t.id)}
                className={cn(
                  "rounded-lg border-2 p-4.5 flex items-center gap-3.5 text-left",
                  isWinner ? "bg-gold/12 border-gold/45" : "bg-cream/5 border-cream/10",
                )}
              >
                <div
                  className="w-11.5 h-11.5 rounded-pill flex items-center justify-center font-mono font-semibold text-xl text-ink"
                  style={{ background: capRingPairs[t.color].light }}
                >
                  {rank ?? "–"}
                </div>
                <div className="flex-1">
                  <div className="font-heading font-semibold text-heading text-cream">
                    {t.players.map((p) => p.name).join(" & ")}
                  </div>
                  {t.players.length > 1 && (
                    <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/45">
                      {t.label}
                    </div>
                  )}
                </div>
                {rank !== null && (
                  <div className="font-mono font-semibold text-[22px]" style={{ color: capRingPairs[t.color].light }}>
                    #{rank}
                  </div>
                )}
              </button>
            );
          })}
          {shotLog.length === 0 && (
            <div className="mt-0.5 p-4 rounded-md bg-red/12 border border-red/35 font-body text-sm text-red-pale">
              Heads up — you logged 0 shots this game. We&apos;ll still count the result, but the brag screen will
              be a bit thin.
            </div>
          )}
        </div>
      )}

      <div className="px-5 pt-3.5">
        <PrimaryButton className="h-16 w-full" size="lg" disabled={!canAdvance || isPending} onClick={next}>
          {isPending
            ? "Saving…"
            : step < 4
              ? ["NEXT", "NEXT", "LOCK IN TEAMS", "DONE FLICKING"][step]
              : "SAVE THE GAME"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function MatTile({
  label,
  sub,
  dots,
  selected,
  onClick,
}: Readonly<{
  label: string;
  sub: string;
  dots: CapRingColor[];
  selected: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-xl p-6 flex flex-col justify-between text-left border-2",
        selected ? "bg-gradient-alt border-gold" : "bg-cream/5 border-cream/10",
      )}
    >
      <div className="flex gap-2 flex-wrap max-w-50">
        {dots.map((ring, i) => (
          <div key={i} className="w-9 h-9 rounded-pill" style={{ background: capRingGradient(ring) }} />
        ))}
      </div>
      <div>
        <div className="font-display text-[56px] leading-[0.9] text-cream">{label}</div>
        <div className="font-body text-[15px] text-cream/55 mt-1">{sub}</div>
      </div>
    </button>
  );
}
