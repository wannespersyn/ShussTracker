import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tournaments, tournamentEntrants, tournamentMatches } from "@/lib/db/schema";

function bracketSizeFor(n: number): { size: number; rounds: number } {
  let size = 1;
  let rounds = 0;
  while (size < n) {
    size *= 2;
    rounds++;
  }
  return { size, rounds };
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

export type TournamentSummary = {
  id: string;
  name: string;
  status: "setup" | "active" | "completed";
  createdAt: Date;
};

/** A crew's tournaments, newest first — for a "resume" list on the crew
 * detail page. */
export async function getGroupTournaments(groupId: string): Promise<TournamentSummary[]> {
  const rows = await db.query.tournaments.findMany({ where: eq(tournaments.groupId, groupId) });
  return [...rows]
    .map((t) => ({ id: t.id, name: t.name, status: t.status, createdAt: t.createdAt }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Creates a tournament, its entrants, and a full single-elimination
 * bracket in one go. Entrants are padded to the next power of two with
 * byes (auto-advance, no game needed) via `seedOrder` — this intentionally
 * skips the manual "lucky loser" slot seen on real bracket sheets (e.g.
 * printable knock-out generators): that call is a subjective judgment and
 * not worth the schema complexity for a casual app. Needs at least 2
 * duos. */
export async function createTournament(
  groupId: string,
  createdBy: string,
  name: string,
  eventId: string | undefined,
  entrantPairs: [string, string][],
): Promise<string> {
  const n = entrantPairs.length;
  if (n < 2) throw new Error("Need at least 2 duos to start a tournament");

  const tournamentId = randomUUID();
  const entrantIds = entrantPairs.map(() => randomUUID());
  const { size: bracketSize, rounds: totalRounds } = bracketSizeFor(n);
  const order = seedOrder(bracketSize);
  const entrantIdForSeed = (seed: number) => (seed <= n ? entrantIds[seed - 1] : null);

  const round1Count = bracketSize / 2;
  const entrantAByKey = new Map<string, string | null>();
  const entrantBByKey = new Map<string, string | null>();
  const winnerByKey = new Map<string, string>();

  for (let s = 0; s < round1Count; s++) {
    const a = entrantIdForSeed(order[2 * s]);
    const b = entrantIdForSeed(order[2 * s + 1]);
    entrantAByKey.set(`1:${s}`, a);
    entrantBByKey.set(`1:${s}`, b);
    if (a && !b) winnerByKey.set(`1:${s}`, a);
    else if (!a && b) winnerByKey.set(`1:${s}`, b);
  }
  if (totalRounds >= 2) {
    for (let s = 0; s < round1Count; s++) {
      const winner = winnerByKey.get(`1:${s}`);
      if (!winner) continue;
      const key = `2:${Math.floor(s / 2)}`;
      if (s % 2 === 0) entrantAByKey.set(key, winner);
      else entrantBByKey.set(key, winner);
    }
  }

  const matchInserts: {
    id: string;
    tournamentId: string;
    round: number;
    slot: number;
    entrantAId: string | null;
    entrantBId: string | null;
    winnerEntrantId: string | null;
  }[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const count = bracketSize / 2 ** r;
    for (let s = 0; s < count; s++) {
      const key = `${r}:${s}`;
      matchInserts.push({
        id: randomUUID(),
        tournamentId,
        round: r,
        slot: s,
        entrantAId: entrantAByKey.get(key) ?? null,
        entrantBId: entrantBByKey.get(key) ?? null,
        winnerEntrantId: winnerByKey.get(key) ?? null,
      });
    }
  }

  const [firstStatement, ...restStatements] = [
    db.insert(tournaments).values({
      id: tournamentId,
      groupId,
      ...(eventId ? { eventId } : {}),
      name,
      status: "active",
      createdBy,
    }),
    ...entrantPairs.map(([player1Id, player2Id], i) =>
      db.insert(tournamentEntrants).values({ id: entrantIds[i], tournamentId, seed: i + 1, player1Id, player2Id }),
    ),
    ...matchInserts.map((m) => db.insert(tournamentMatches).values(m)),
  ];
  await db.batch([firstStatement, ...restStatements]);

  return tournamentId;
}

export type TournamentEntrantView = { id: string; seed: number; names: string; playerIds: [string, string] };
export type TournamentMatchView = {
  id: string;
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
  status: "setup" | "active" | "completed";
  groupId: string;
  groupName: string;
  eventId: string | null;
  totalRounds: number;
  matchesByRound: TournamentMatchView[][];
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

  const totalRounds = t.matches.reduce((max, m) => Math.max(max, m.round), 0);
  const matchesByRound: TournamentMatchView[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    matchesByRound.push(
      t.matches
        .filter((m) => m.round === r)
        .sort((a, b) => a.slot - b.slot)
        .map((m) => ({
          id: m.id,
          round: m.round,
          slot: m.slot,
          entrantA: m.entrantAId ? (entrantById.get(m.entrantAId) ?? null) : null,
          entrantB: m.entrantBId ? (entrantById.get(m.entrantBId) ?? null) : null,
          winnerEntrantId: m.winnerEntrantId,
          gameId: m.gameId,
        })),
    );
  }

  const finalMatch = matchesByRound.at(-1)?.[0] ?? null;
  const championEntrant =
    t.status === "completed" && finalMatch?.winnerEntrantId
      ? (entrantById.get(finalMatch.winnerEntrantId) ?? null)
      : null;

  return {
    id: t.id,
    name: t.name,
    status: t.status,
    groupId: t.groupId,
    groupName: t.group.name,
    eventId: t.eventId,
    totalRounds,
    matchesByRound,
    championEntrant,
  };
}

/** Records a played match's result and propagates the winner into the
 * next round's slot — or marks the tournament complete if this was the
 * final. */
export async function recordMatchResult(matchId: string, gameId: string, winnerEntrantId: string): Promise<void> {
  const match = await db.query.tournamentMatches.findFirst({ where: eq(tournamentMatches.id, matchId) });
  if (!match) throw new Error("Match not found");

  await db.update(tournamentMatches).set({ gameId, winnerEntrantId }).where(eq(tournamentMatches.id, matchId));

  const nextMatch = await db.query.tournamentMatches.findFirst({
    where: and(
      eq(tournamentMatches.tournamentId, match.tournamentId),
      eq(tournamentMatches.round, match.round + 1),
      eq(tournamentMatches.slot, Math.floor(match.slot / 2)),
    ),
  });

  if (nextMatch) {
    const field = match.slot % 2 === 0 ? "entrantAId" : "entrantBId";
    await db.update(tournamentMatches).set({ [field]: winnerEntrantId }).where(eq(tournamentMatches.id, nextMatch.id));
  } else {
    await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, match.tournamentId));
  }
}
