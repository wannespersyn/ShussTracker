import { initialsFor } from "@/lib/format";
import type { CapRingColor } from "@/lib/theme/tokens";
import { ELO_BASE } from "@/lib/elo";

export const TEAM_COLORS: CapRingColor[] = ["gold", "red", "mint", "cream"];

export type RosterPlayer = { id: string; name: string };
export type TeamPlayer = RosterPlayer & { initials: string; ring: CapRingColor };
export type Duo = { id: string; label: string; color: CapRingColor; players: TeamPlayer[] };

export function toTeamPlayers(roster: RosterPlayer[]): TeamPlayer[] {
  return roster.map((p, i) => ({
    ...p,
    initials: initialsFor(p.name),
    ring: TEAM_COLORS[i % TEAM_COLORS.length],
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pairs an even-sized, already-ordered list into consecutive duos —
 * position 0+1 form team 1, 2+3 form team 2, etc. Used directly when an
 * order was already decided elsewhere (a Chwazi shuffle handed off across
 * a page navigation, tournament entrant seeding); `shuffleIntoDuos`
 * layers randomization on top of this. */
export function pairIntoDuos(players: TeamPlayer[]): Duo[] {
  const duos: Duo[] = [];
  for (let i = 0; i < players.length; i += 2) {
    duos.push({
      id: `team-${i / 2}`,
      label: `Team ${i / 2 + 1}`,
      color: TEAM_COLORS[(i / 2) % TEAM_COLORS.length],
      players: [players[i], players[i + 1]],
    });
  }
  return duos;
}

/** Randomly splits an even-sized roster into duos ("chwazi"-style), cycling
 * through TEAM_COLORS for each duo's ring color. Used by the log wizard's
 * duo-shuffle step, the Chwazi picker, and tournament entrant seeding. */
export function shuffleIntoDuos(players: TeamPlayer[]): Duo[] {
  return pairIntoDuos(shuffle(players));
}

/** Chwazi's "balance by skill" option — sorts by rating and pairs the
 * strongest with the weakest, next-strongest with next-weakest, and so on
 * ("snake" pairing), so every resulting duo has a similar combined rating
 * instead of leaving one duo stacked and another sunk. Which duo lands in
 * which slot (and its color) is still randomized, so the pairing is
 * balanced but the presentation isn't predictable. Unrated players fall
 * back to the Elo base rating (see lib/elo.ts's ELO_BASE). */
export function balanceIntoDuos(players: TeamPlayer[], ratings: Record<string, number>): Duo[] {
  const ratingOf = (id: string) => ratings[id] ?? ELO_BASE;
  const sorted = [...players].sort((a, b) => ratingOf(b.id) - ratingOf(a.id));

  const pairs: TeamPlayer[][] = [];
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    pairs.push([sorted[lo], sorted[hi]]);
    lo++;
    hi--;
  }

  return shuffle(pairs).map((pair, i) => ({
    id: `team-${i}`,
    label: `Team ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    players: pair,
  }));
}

/** Splits a 2-player roster into two solo "teams" of one — the 2-player
 * mat's head-to-head mode, where there's no duo to pair up. */
export function pairIntoSolos(players: TeamPlayer[]): Duo[] {
  return players.map((p, i) => ({
    id: `team-${i}`,
    label: p.name,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    players: [p],
  }));
}
