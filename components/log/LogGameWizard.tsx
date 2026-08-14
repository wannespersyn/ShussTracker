"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { capCrownClipPath, capRingGradient, capRingPairs, type CapRingColor } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";
import { PrimaryButton } from "@/components/ui";
import { logGame } from "@/app/(app)/log/actions";

const TEAM_COLORS: CapRingColor[] = ["gold", "red", "mint", "cream"];
const FIELD_HITS = ["3", "2", "1", "mama", "miss"] as const;
type FieldHit = (typeof FIELD_HITS)[number];

type RosterPlayer = { id: string; name: string };
type Player = RosterPlayer & { initials: string; ring: CapRingColor };
type Team = { id: string; label: string; color: CapRingColor; players: [Player, Player] };
type FlyingCap = { id: number; left: string; top: string };

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildTeams(players: Player[]): Team[] {
  const shuffled = shuffle(players);
  const teams: Team[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    teams.push({
      id: `team-${i / 2}`,
      label: `Team ${i / 2 + 1}`,
      color: TEAM_COLORS[(i / 2) % TEAM_COLORS.length],
      players: [shuffled[i], shuffled[i + 1]],
    });
  }
  return teams;
}

const STEP_COPY = [
  { kicker: "New game", title: "Pick your mat" },
  { kicker: "Step 2 of 4", title: "Set the duos" },
  { kicker: "Step 3 of 4", title: "Flick 'em" },
  { kicker: "Last call", title: "Who won" },
];

export function LogGameWizard({ groupId, roster }: { groupId: string; roster: RosterPlayer[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const players = useMemo<Player[]>(
    () =>
      roster.map((p, i) => ({
        ...p,
        initials: initialsFor(p.name),
        ring: TEAM_COLORS[i % TEAM_COLORS.length],
      })),
    [roster],
  );

  const [step, setStep] = useState(0);
  const [matType, setMatType] = useState<"4" | "8" | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeShooterId, setActiveShooterId] = useState<string | null>(null);
  const [shotLog, setShotLog] = useState<{ playerId: string; fieldHit: FieldHit }[]>([]);
  const [flyingCaps, setFlyingCaps] = useState<FlyingCap[]>([]);
  const [winnerTeamId, setWinnerTeamId] = useState<string | null>(null);
  const [rankedTeamIds, setRankedTeamIds] = useState<string[]>([]);

  const gamePlayers = teams?.flatMap((t) => t.players) ?? [];
  const needed = matType === "8" ? 8 : 4;
  const notEnoughPlayers = matType !== null && players.length < needed;

  function pickMat(type: "4" | "8") {
    setMatType(type);
    const need = type === "8" ? 8 : 4;
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

  function shuffleDuos() {
    if (!teams) return;
    setTeams(buildTeams(gamePlayers));
    setSelectedPlayerId(null);
  }

  function tapPlayer(playerId: string) {
    if (!teams) return;
    if (selectedPlayerId === null) {
      setSelectedPlayerId(playerId);
      return;
    }
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      return;
    }
    setTeams((prev) => {
      if (!prev) return prev;
      const flat = prev.flatMap((t) => t.players);
      const a = flat.find((p) => p.id === selectedPlayerId)!;
      const b = flat.find((p) => p.id === playerId)!;
      return prev.map((t) => ({
        ...t,
        players: t.players.map((p) => (p.id === a.id ? b : p.id === b.id ? a : p)) as [Player, Player],
      }));
    });
    setSelectedPlayerId(null);
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

  function tapRank(teamId: string) {
    setRankedTeamIds((prev) => (prev.includes(teamId) ? prev : [...prev, teamId]));
  }

  const canAdvance =
    (step === 0 && matType !== null && !notEnoughPlayers && selectedPlayerIds.length === needed) ||
    (step === 1 && teams !== null) ||
    step === 2 ||
    (step === 3 && matType === "4" ? winnerTeamId !== null : rankedTeamIds.length === teams?.length);

  function next() {
    if (step < 3) {
      if (step === 0) {
        setTeams(buildTeams(players.filter((p) => selectedPlayerIds.includes(p.id))));
      }
      if (step === 1) setActiveShooterId(teams?.[0].players[0].id ?? null);
      setStep((s) => s + 1);
      return;
    }
    // Final step — submit.
    if (!teams) return;
    const finalTeams =
      matType === "4"
        ? teams.map((t) => ({
            label: t.label,
            playerIds: t.players.map((p) => p.id),
            finalRank: t.id === winnerTeamId ? 1 : 2,
          }))
        : teams.map((t) => ({
            label: t.label,
            playerIds: t.players.map((p) => p.id),
            finalRank: rankedTeamIds.indexOf(t.id) + 1,
          }));

    startTransition(() => {
      logGame({
        groupId,
        matType: matType!,
        teams: finalTeams,
        shotsByPlayer: shotLog,
      });
    });
  }

  function back() {
    if (step === 0) {
      router.push("/home");
      return;
    }
    setStep((s) => s - 1);
  }

  const tally = FIELD_HITS.map((fh) => ({
    fieldHit: fh,
    label: fh === "mama" ? "RISK" : fh === "miss" ? "MISS" : fh,
    n: shotLog.filter((s) => s.fieldHit === fh).length,
    color: fh === "mama" ? "var(--color-red-bright)" : fh === "miss" ? "rgba(246,239,221,.4)" : "var(--color-cream)",
  }));

  const copy = STEP_COPY[step];
  const dots = [1, 2, 3].map((i) => (step >= i ? "bg-gold" : "bg-cream/15"));

  return (
    <div className="relative min-h-screen bg-surface flex flex-col pt-16.5 pb-2">
      <div className="px-5 flex items-center gap-3.5">
        <button
          type="button"
          onClick={back}
          className="w-10.5 h-10.5 rounded-md bg-cream/10 flex items-center justify-center text-cream text-xl"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="font-heading font-semibold text-[13px] tracking-[1.8px] uppercase text-cream/45">
            {copy.kicker}
          </div>
          <div className="font-display text-display-sm tracking-[0.6px] text-cream">{copy.title}</div>
        </div>
        <div className="flex gap-1.25">
          <div className="w-5.5 h-1.25 rounded-[3px] bg-gold" />
          {dots.map((c, i) => (
            <div key={i} className={cn("w-5.5 h-1.25 rounded-[3px]", c)} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="flex-1 px-5 py-6.5 flex flex-col gap-4">
          <MatTile
            label="4 PLAYERS"
            sub="One mat, two duos, quick round."
            dots={["gold", "gold", "cream", "cream"]}
            selected={matType === "4"}
            onClick={() => pickMat("4")}
          />
          <MatTile
            label="8 PLAYERS"
            sub="Four duos, full ranking at the end."
            dots={["red", "red", "gold", "gold", "cream", "cream", "mint", "mint"]}
            selected={matType === "8"}
            onClick={() => pickMat("8")}
          />
          {notEnoughPlayers && (
            <div className="text-center font-body text-body-sm text-red-pale">
              Your crew only has {players.length} — need {needed} for this mat.
            </div>
          )}
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
                        picked ? "bg-gold text-surface" : "bg-cream/8 text-cream/70",
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && teams && (
        <div className="flex-1 px-5 pt-5.5 flex flex-col gap-3.5 overflow-auto">
          <div className="flex items-baseline gap-2">
            <div className="font-heading font-bold text-[12px] tracking-[1.6px] uppercase text-gold">
              {matType}-PLAYER MAT
            </div>
            <div className="flex-1 font-body text-sm text-cream/55">
              Tap two names to swap. Nobody&apos;s stuck with their partner.
            </div>
          </div>
          {teams.map((t) => (
            <div key={t.id} className="rounded-lg bg-cream/5 border border-cream/10 p-3.5 pb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-3.5 h-3.5 rounded-pill" style={{ background: capRingPairs[t.color].light }} />
                <div className="font-heading font-bold text-sm tracking-[1.8px] uppercase text-cream/70">
                  {t.label}
                </div>
              </div>
              <div className="flex gap-2.5">
                {t.players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => tapPlayer(p.id)}
                    className={cn(
                      "flex-1 h-16 rounded-md font-display text-[22px] flex items-center justify-center",
                      selectedPlayerId === p.id
                        ? "bg-gold/20 border-2 border-gold text-gold"
                        : "bg-cream/8 border-2 border-transparent text-cream",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={shuffleDuos}
            className="h-13 rounded-md border-2 border-dashed border-cream/22 flex items-center justify-center gap-2 font-heading font-bold text-base tracking-[1.6px] uppercase text-cream/65"
          >
            ↻ Shuffle the duos
          </button>
        </div>
      )}

      {step === 2 && teams && (
        <div className="flex-1 px-5 pt-4 flex flex-col relative">
          <div className="flex flex-wrap gap-2 mb-3.5">
            {gamePlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveShooterId(p.id)}
                className={cn(
                  "flex-1 min-w-19 h-11 rounded-md font-heading font-bold text-sm tracking-[0.6px]",
                  activeShooterId === p.id ? "bg-gold text-surface" : "bg-cream/8 text-cream/70",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="relative rounded-xl overflow-hidden bg-cream border-3 border-surface-deep p-3 h-82.5">
            <button type="button" onClick={() => logShot("3")} className="w-full h-18.5 rounded-md bg-field-far flex items-center justify-between px-4">
              <div className="font-display text-4xl text-cream">3</div>
              <div className="font-heading font-bold text-sm tracking-[1.6px] text-cream/75">FAR FIELD</div>
            </button>
            <button type="button" onClick={() => logShot("2")} className="mt-2 w-full h-18.5 rounded-md bg-field-mid flex items-center justify-between px-4">
              <div className="font-display text-4xl text-cream">2</div>
              <div className="font-heading font-bold text-sm tracking-[1.6px] text-cream/75">MID FIELD</div>
            </button>
            <button type="button" onClick={() => logShot("1")} className="mt-2 w-full h-18.5 rounded-md bg-field-near flex items-center justify-between px-4">
              <div className="font-display text-4xl text-cream">1</div>
              <div className="font-heading font-bold text-sm tracking-[1.6px] text-cream/80">NEAR FIELD</div>
            </button>
            <button
              type="button"
              onClick={() => logShot("mama")}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-pill bg-red border-5 border-cream flex flex-col items-center justify-center animate-glow"
            >
              <div className="font-display text-2xl text-white leading-none">RISK</div>
              <div className="font-heading font-bold text-[11px] tracking-[1.4px] text-white/85">THEY CHUG</div>
            </button>
            {flyingCaps.map((c) => (
              <div
                key={c.id}
                className="absolute w-10 h-10 animate-fly pointer-events-none shadow-elevation-sm"
                style={{ left: c.left, top: c.top, background: capRingGradient("gold"), clipPath: capCrownClipPath }}
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
                <div className="font-display text-[22px]" style={{ color: t.color }}>
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

      {step === 3 && teams && (
        <div className="flex-1 px-5 pt-5.5 flex flex-col gap-3 overflow-auto">
          <div className="font-body text-[14.5px] text-cream/55">
            {matType === "4" ? "Tap the winning duo." : "Tap teams in order of finish, best first."}
          </div>
          {teams.map((t) => {
            const rank = matType === "4" ? (t.id === winnerTeamId ? 1 : winnerTeamId ? 2 : null) : rankedTeamIds.indexOf(t.id) + 1 || null;
            const isWinner = rank === 1;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => (matType === "4" ? tapWinner(t.id) : tapRank(t.id))}
                className={cn(
                  "rounded-lg border-2 p-4.5 flex items-center gap-3.5 text-left",
                  isWinner ? "bg-gold/12 border-gold/45" : "bg-cream/5 border-cream/10",
                )}
              >
                <div
                  className="w-11.5 h-11.5 rounded-pill flex items-center justify-center font-display text-xl text-surface"
                  style={{ background: capRingPairs[t.color].light }}
                >
                  {rank ?? "–"}
                </div>
                <div className="flex-1">
                  <div className="font-display text-2xl text-cream">
                    {t.players.map((p) => p.name).join(" & ")}
                  </div>
                  <div className="font-heading font-semibold text-[13px] tracking-[1.4px] uppercase text-cream/45">
                    {t.label}
                  </div>
                </div>
                {rank !== null && (
                  <div className="font-display text-[34px]" style={{ color: capRingPairs[t.color].light }}>
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
          {isPending ? "Saving…" : step < 3 ? ["NEXT", "LOCK IN TEAMS", "DONE FLICKING"][step] : "SAVE THE GAME"}
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
}: {
  label: string;
  sub: string;
  dots: CapRingColor[];
  selected: boolean;
  onClick: () => void;
}) {
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
          <div
            key={i}
            className="w-9 h-9"
            style={{ background: capRingGradient(ring), clipPath: capCrownClipPath }}
          />
        ))}
      </div>
      <div>
        <div className="font-display text-[56px] leading-[0.9] text-cream">{label}</div>
        <div className="font-body text-[15px] text-cream/55 mt-1">{sub}</div>
      </div>
    </button>
  );
}
