import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runAtomic } from "@/lib/db/batch";
import { tournaments, tournamentEntrants, tournamentMatches } from "@/lib/db/schema";

export type TournamentFormat = "single_elim" | "double_elim" | "round_robin";

function bracketSizeFor(n: number): { size: number; rounds: number } {
  let size = 1;
  let rounds = 0;
  while (size < n) {
    size *= 2;
    rounds++;
  }
  return { size, rounds };
}

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/** Standard single-elimination seed order (seed 1 plays the lowest seed,
 * seed 2 the second-lowest, etc.), built recursively. Because the bracket
 * is always sized to the *smallest* power of two that fits the real
 * entrant count, byes (seeds beyond that count) are always fewer than
 * half the first-round matches — this order guarantees each match gets
 * at most one, so no match is ever left with zero real entrants. */
function seedOrder(size: number): number[] {
  if (size === 1) return [1];
  const prev = seedOrder(size / 2);
  const out: number[] = [];
  for (const s of prev) out.push(s, size + 1 - s);
  return out;
}

type MatchInsert = {
  id: string;
  tournamentId: string;
  bracket: "winners" | "losers" | "grand_final" | "round_robin";
  round: number;
  slot: number;
  entrantAId: string | null;
  entrantBId: string | null;
  winnerEntrantId: string | null;
  winnerNextMatchId: string | null;
  winnerNextSlot: "a" | "b" | null;
  loserNextMatchId: string | null;
  loserNextSlot: "a" | "b" | null;
};

/** Builds a single-elimination winners bracket, padded to the next power
 * of two with byes (auto-advance, no game needed). `onFinalWinner`, when
 * given, is where the bracket champion's match points instead of leaving
 * `winnerNextMatchId` null — used by double-elim to route the winners
 * champion into the grand final. Returns the matches plus, for each
 * round-1 match, whether it was a bye (so the caller can route byes'
 * nonexistent losers away from a losers bracket). */
function buildEliminationBracket(
  tournamentId: string,
  entrantIds: string[],
  onFinalWinner?: { matchId: string; slot: "a" | "b" },
): { matches: MatchInsert[]; byIdKey: Map<string, MatchInsert>; totalRounds: number; bracketSize: number } {
  const n = entrantIds.length;
  const { size: bracketSize, rounds: totalRounds } = bracketSizeFor(n);
  const order = seedOrder(bracketSize);
  const entrantIdForSeed = (seed: number) => (seed <= n ? entrantIds[seed - 1] : null);

  // Pre-assign every match's id so pointers can be wired up before insert.
  const byIdKey = new Map<string, MatchInsert>();
  for (let r = 1; r <= totalRounds; r++) {
    const count = bracketSize / 2 ** r;
    for (let s = 0; s < count; s++) {
      byIdKey.set(`${r}:${s}`, {
        id: randomUUID(),
        tournamentId,
        bracket: "winners",
        round: r,
        slot: s,
        entrantAId: null,
        entrantBId: null,
        winnerEntrantId: null,
        winnerNextMatchId: null,
        winnerNextSlot: null,
        loserNextMatchId: null,
        loserNextSlot: null,
      });
    }
  }

  // Wire winner-advancement pointers (round r, slot s -> round r+1, slot
  // floor(s/2)), or the caller's override for the bracket final.
  for (let r = 1; r <= totalRounds; r++) {
    const count = bracketSize / 2 ** r;
    for (let s = 0; s < count; s++) {
      const m = byIdKey.get(`${r}:${s}`)!;
      if (r < totalRounds) {
        const next = byIdKey.get(`${r + 1}:${Math.floor(s / 2)}`)!;
        m.winnerNextMatchId = next.id;
        m.winnerNextSlot = s % 2 === 0 ? "a" : "b";
      } else if (onFinalWinner) {
        m.winnerNextMatchId = onFinalWinner.matchId;
        m.winnerNextSlot = onFinalWinner.slot;
      }
    }
  }

  // Seed round 1, resolving byes (a lone real entrant) immediately and
  // propagating that free win into round 2 — deeper bye chains (round 2
  // itself ending up a bye) aren't chased further; vanishingly rare given
  // the "fewer than half of round 1" bye guarantee, and not worth the
  // complexity for a casual bracket.
  const round1Count = bracketSize / 2;
  for (let s = 0; s < round1Count; s++) {
    const m = byIdKey.get(`1:${s}`)!;
    const a = entrantIdForSeed(order[2 * s]);
    const b = entrantIdForSeed(order[2 * s + 1]);
    m.entrantAId = a;
    m.entrantBId = b;
    const byeWinner = a && !b ? a : !a && b ? b : null;
    if (byeWinner) {
      m.winnerEntrantId = byeWinner;
      if (m.winnerNextMatchId) {
        const next = byIdKey.get(totalRounds >= 2 ? `2:${Math.floor(s / 2)}` : "")!;
        if (next) {
          if (m.winnerNextSlot === "a") next.entrantAId = byeWinner;
          else next.entrantBId = byeWinner;
        }
      }
    }
  }

  // Insert order matters: a match's `winnerNextMatchId`/`loserNextMatchId`
  // FK must already exist in the table by the time its row is inserted
  // (Postgres checks each statement's FKs immediately, even inside one
  // batch/transaction), so later rounds — which nothing points forward
  // into — must land before the earlier rounds that point at them.
  const matches = [...byIdKey.values()].sort((a, b) => b.round - a.round);
  return { matches, byIdKey, totalRounds, bracketSize };
}

/** Wires a double-elimination losers bracket onto an already-built winners
 * bracket (see `buildEliminationBracket`). Requires `entrantIds.length` to
 * be an exact power of two (validated by the caller) so round 1 has no
 * byes — that keeps every losers-bracket slot fed by a real, eventual
 * loser instead of having to reason about byes with no loser to drop.
 *
 * Standard double-elim losers-bracket shape for a winners bracket of k
 * rounds: L = 2*(k-1) losers rounds. Round 1 pairs winners-round-1's
 * losers against each other; every even round after that is a "drop-in"
 * pairing a losers-bracket survivor against a fresh loser dropping from
 * winners round (round/2 + 1); every odd round from 3 on is a
 * "consolidation" pairing two losers-bracket survivors together. The
 * final losers round is always even, so it always ends by absorbing the
 * winners-bracket final's loser — the classic "one more shot" design. */
function buildLosersBracket(
  tournamentId: string,
  winners: { byIdKey: Map<string, MatchInsert>; totalRounds: number; bracketSize: number },
  grandFinalMatchId: string,
): MatchInsert[] {
  const k = winners.totalRounds;
  if (k < 2) return [];
  const L = 2 * (k - 1);

  const countFor = (lb: number) => winners.bracketSize / 2 ** (Math.ceil(lb / 2) + 1);

  const losers = new Map<string, MatchInsert>();
  for (let lb = 1; lb <= L; lb++) {
    const count = countFor(lb);
    for (let s = 0; s < count; s++) {
      losers.set(`${lb}:${s}`, {
        id: randomUUID(),
        tournamentId,
        bracket: "losers",
        round: lb,
        slot: s,
        entrantAId: null,
        entrantBId: null,
        winnerEntrantId: null,
        winnerNextMatchId: null,
        winnerNextSlot: null,
        loserNextMatchId: null, // losers-bracket losers are simply eliminated
        loserNextSlot: null,
      });
    }
  }

  // Winner-advancement within the losers bracket.
  for (let lb = 1; lb <= L; lb++) {
    const count = countFor(lb);
    for (let s = 0; s < count; s++) {
      const m = losers.get(`${lb}:${s}`)!;
      if (lb === L) {
        m.winnerNextMatchId = grandFinalMatchId;
        m.winnerNextSlot = "b";
      } else if (lb % 2 === 1) {
        // Fresh-pair (lb=1) or consolidation round -> next round is a
        // drop-in round, same slot index, always slot "a" (the survivor).
        const next = losers.get(`${lb + 1}:${s}`)!;
        m.winnerNextMatchId = next.id;
        m.winnerNextSlot = "a";
      } else {
        // Drop-in round -> next round is a consolidation round pairing
        // adjacent survivors.
        const next = losers.get(`${lb + 1}:${Math.floor(s / 2)}`)!;
        m.winnerNextMatchId = next.id;
        m.winnerNextSlot = s % 2 === 0 ? "a" : "b";
      }
    }
  }

  // Route each winners-bracket match's loser into the losers bracket.
  for (let r = 1; r <= k; r++) {
    const wbCount = winners.bracketSize / 2 ** r;
    for (let s = 0; s < wbCount; s++) {
      const wm = winners.byIdKey.get(`${r}:${s}`)!;
      if (r === 1) {
        // Round-1 losers pair against each other in losers round 1.
        const target = losers.get(`1:${Math.floor(s / 2)}`)!;
        wm.loserNextMatchId = target.id;
        wm.loserNextSlot = s % 2 === 0 ? "a" : "b";
      } else {
        // Round r's losers drop into the losers-bracket round whose
        // drop-in feeds from winners round r, i.e. lb = 2*(r-1).
        const lb = 2 * (r - 1);
        const target = losers.get(`${lb}:${s}`)!;
        wm.loserNextMatchId = target.id;
        wm.loserNextSlot = "b";
      }
    }
  }

  // Same insert-order constraint as the winners bracket (see comment
  // there): later losers rounds before earlier ones.
  return [...losers.values()].sort((a, b) => b.round - a.round);
}

export type TournamentSummary = {
  id: string;
  name: string;
  format: TournamentFormat;
  status: "setup" | "active" | "completed";
  createdAt: Date;
};

/** A crew's tournaments, newest first — for a "resume" list on the crew
 * detail page. */
export async function getGroupTournaments(groupId: string): Promise<TournamentSummary[]> {
  const rows = await db.query.tournaments.findMany({ where: eq(tournaments.groupId, groupId) });
  return [...rows]
    .map((t) => ({ id: t.id, name: t.name, format: t.format, status: t.status, createdAt: t.createdAt }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Creates a tournament, its entrants, and the full match schedule for the
 * given format in one go. Needs at least 2 duos; double elimination
 * additionally needs an exact power-of-two duo count (see
 * `buildLosersBracket`). */
export async function createTournament(
  groupId: string,
  createdBy: string,
  name: string,
  eventId: string | undefined,
  entrantPairs: [string, string][],
  format: TournamentFormat,
): Promise<string> {
  const n = entrantPairs.length;
  if (n < 2) throw new Error("Need at least 2 duos to start a tournament");
  if (format === "double_elim" && !isPowerOfTwo(n)) {
    throw new Error("Double elimination needs an exact power-of-two number of duos (4, 8, 16…) — no byes");
  }

  const tournamentId = randomUUID();
  const entrantIds = entrantPairs.map(() => randomUUID());

  let matchInserts: MatchInsert[];
  if (format === "single_elim") {
    matchInserts = buildEliminationBracket(tournamentId, entrantIds).matches;
  } else if (format === "double_elim") {
    const grandFinalId = randomUUID();
    const winners = buildEliminationBracket(tournamentId, entrantIds, { matchId: grandFinalId, slot: "a" });
    const losersMatches = buildLosersBracket(tournamentId, winners, grandFinalId);
    const grandFinal: MatchInsert = {
      id: grandFinalId,
      tournamentId,
      bracket: "grand_final",
      round: winners.totalRounds + 1,
      slot: 0,
      entrantAId: null,
      entrantBId: null,
      winnerEntrantId: null,
      winnerNextMatchId: null,
      winnerNextSlot: null,
      loserNextMatchId: null,
      loserNextSlot: null,
    };
    // Dependency order for FK inserts: grand final (nothing points into it
    // yet), then losers rounds high-to-low, then winners rounds
    // high-to-low — see the ordering comment in `buildEliminationBracket`.
    matchInserts = [grandFinal, ...losersMatches, ...winners.matches];
  } else {
    matchInserts = buildRoundRobinSchedule(tournamentId, entrantIds);
  }

  await runAtomic((executor) => [
    executor.insert(tournaments).values({
      id: tournamentId,
      groupId,
      ...(eventId ? { eventId } : {}),
      name,
      format,
      status: "active",
      createdBy,
    }),
    ...entrantPairs.map(([player1Id, player2Id], i) =>
      executor.insert(tournamentEntrants).values({ id: entrantIds[i], tournamentId, seed: i + 1, player1Id, player2Id }),
    ),
    ...matchInserts.map((m) => executor.insert(tournamentMatches).values(m)),
  ]);

  return tournamentId;
}

/** Round-robin schedule via the circle method: entrant 0 stays fixed,
 * the rest rotate through the remaining n-1 (or n, if an even sentinel
 * "bye" seat is needed for an odd entrant count) positions across n-1
 * rounds, pairing seat i against seat (n-1-i) each round. The seat
 * holding the bye sentinel simply produces no match that round — no
 * schedule row, no propagation, every match is playable from creation. */
function buildRoundRobinSchedule(tournamentId: string, entrantIds: string[]): MatchInsert[] {
  const n = entrantIds.length;
  const withBye: (string | null)[] = n % 2 === 0 ? [...entrantIds] : [...entrantIds, null];
  const total = withBye.length;
  const rounds = total - 1;

  const seats = [...withBye];
  const matches: MatchInsert[] = [];
  for (let round = 1; round <= rounds; round++) {
    let slot = 0;
    for (let i = 0; i < total / 2; i++) {
      const a = seats[i];
      const b = seats[total - 1 - i];
      if (a && b) {
        matches.push({
          id: randomUUID(),
          tournamentId,
          bracket: "round_robin",
          round,
          slot: slot++,
          entrantAId: a,
          entrantBId: b,
          winnerEntrantId: null,
          winnerNextMatchId: null,
          winnerNextSlot: null,
          loserNextMatchId: null,
          loserNextSlot: null,
        });
      }
    }
    // Rotate everyone but the fixed seat 0.
    seats.splice(1, 0, seats.pop()!);
  }
  return matches;
}

export type TournamentEntrantView = { id: string; seed: number; names: string; playerIds: [string, string] };
export type TournamentMatchView = {
  id: string;
  bracket: "winners" | "losers" | "grand_final" | "round_robin";
  round: number;
  slot: number;
  entrantA: TournamentEntrantView | null;
  entrantB: TournamentEntrantView | null;
  winnerEntrantId: string | null;
  gameId: string | null;
};
export type TournamentDetail = {
  id: string;
  name: string;
  format: TournamentFormat;
  status: "setup" | "active" | "completed";
  groupId: string;
  groupName: string;
  eventId: string | null;
  /** Single-elim: the whole bracket. Double-elim: the winners side only. */
  winnersRounds: TournamentMatchView[][];
  /** Double-elim only. */
  losersRounds: TournamentMatchView[][];
  grandFinal: TournamentMatchView | null;
  /** Round-robin only. */
  roundRobinRounds: TournamentMatchView[][];
  standings: { entrant: TournamentEntrantView; wins: number; played: number }[];
  championEntrant: TournamentEntrantView | null;
};

export async function getTournament(tournamentId: string): Promise<TournamentDetail | null> {
  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
    with: {
      group: true,
      entrants: { with: { player1: true, player2: true } },
      matches: true,
    },
  });
  if (!t) return null;

  const entrantById = new Map<string, TournamentEntrantView>(
    t.entrants.map((e) => [
      e.id,
      {
        id: e.id,
        seed: e.seed,
        names: `${e.player1.name?.split(" ")[0] ?? "Player"} & ${e.player2.name?.split(" ")[0] ?? "Player"}`,
        playerIds: [e.player1Id, e.player2Id],
      },
    ]),
  );

  const toView = (m: (typeof t.matches)[number]): TournamentMatchView => ({
    id: m.id,
    bracket: m.bracket,
    round: m.round,
    slot: m.slot,
    entrantA: m.entrantAId ? (entrantById.get(m.entrantAId) ?? null) : null,
    entrantB: m.entrantBId ? (entrantById.get(m.entrantBId) ?? null) : null,
    winnerEntrantId: m.winnerEntrantId,
    gameId: m.gameId,
  });

  const groupByRound = (matches: TournamentMatchView[]) => {
    const totalRounds = matches.reduce((max, m) => Math.max(max, m.round), 0);
    const out: TournamentMatchView[][] = [];
    for (let r = 1; r <= totalRounds; r++) {
      out.push(
        matches
          .filter((m) => m.round === r)
          .sort((a, b) => a.slot - b.slot),
      );
    }
    return out;
  };

  const winnersMatches = t.matches.filter((m) => m.bracket === "winners").map(toView);
  const losersMatches = t.matches.filter((m) => m.bracket === "losers").map(toView);
  const grandFinalMatch = t.matches.find((m) => m.bracket === "grand_final");
  const roundRobinMatches = t.matches.filter((m) => m.bracket === "round_robin").map(toView);

  const winnersRounds = groupByRound(winnersMatches);
  const losersRounds = groupByRound(losersMatches);
  const grandFinal = grandFinalMatch ? toView(grandFinalMatch) : null;
  const roundRobinRounds = groupByRound(roundRobinMatches);

  const standings =
    t.format === "round_robin"
      ? [...t.entrants]
          .map((e) => {
            const played = roundRobinMatches.filter(
              (m) => m.gameId && (m.entrantA?.id === e.id || m.entrantB?.id === e.id),
            );
            const wins = played.filter((m) => m.winnerEntrantId === e.id).length;
            return { entrant: entrantById.get(e.id)!, wins, played: played.length };
          })
          .sort((a, b) => b.wins - a.wins || a.entrant.seed - b.entrant.seed)
      : [];

  const championEntrant =
    t.status !== "completed"
      ? null
      : t.format === "round_robin"
        ? (standings[0]?.entrant ?? null)
        : t.format === "double_elim"
          ? grandFinal?.winnerEntrantId
            ? (entrantById.get(grandFinal.winnerEntrantId) ?? null)
            : null
          : (winnersRounds.at(-1)?.[0]?.winnerEntrantId
              ? (entrantById.get(winnersRounds.at(-1)![0].winnerEntrantId!) ?? null)
              : null);

  return {
    id: t.id,
    name: t.name,
    format: t.format,
    status: t.status,
    groupId: t.groupId,
    groupName: t.group.name,
    eventId: t.eventId,
    winnersRounds,
    losersRounds,
    grandFinal,
    roundRobinRounds,
    standings,
    championEntrant,
  };
}

/** Records a played match's result and propagates the winner (and, for
 * double-elim, the loser) into whichever match its pointers name — or
 * marks the tournament complete, either because this was a decisive match
 * with nowhere further to send its winner (single/double-elim) or because
 * it was round-robin's last unplayed match. */
export async function recordMatchResult(matchId: string, gameId: string, winnerEntrantId: string): Promise<void> {
  const match = await db.query.tournamentMatches.findFirst({ where: eq(tournamentMatches.id, matchId) });
  if (!match) throw new Error("Match not found");

  const loserEntrantId = match.entrantAId === winnerEntrantId ? match.entrantBId : match.entrantAId;

  await db.update(tournamentMatches).set({ gameId, winnerEntrantId }).where(eq(tournamentMatches.id, matchId));

  if (match.winnerNextMatchId) {
    const field = match.winnerNextSlot === "a" ? "entrantAId" : "entrantBId";
    await db
      .update(tournamentMatches)
      .set({ [field]: winnerEntrantId })
      .where(eq(tournamentMatches.id, match.winnerNextMatchId));
  }
  if (match.loserNextMatchId && loserEntrantId) {
    const field = match.loserNextSlot === "a" ? "entrantAId" : "entrantBId";
    await db
      .update(tournamentMatches)
      .set({ [field]: loserEntrantId })
      .where(eq(tournamentMatches.id, match.loserNextMatchId));
  }

  if (match.bracket === "round_robin") {
    const siblings = await db.query.tournamentMatches.findMany({
      where: and(eq(tournamentMatches.tournamentId, match.tournamentId), eq(tournamentMatches.bracket, "round_robin")),
    });
    const allPlayed = siblings.every((m) => m.id === match.id || m.winnerEntrantId !== null);
    if (allPlayed) {
      await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, match.tournamentId));
    }
  } else if (!match.winnerNextMatchId) {
    await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, match.tournamentId));
  }
}
