import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, games } from "@/lib/db/schema";
import { scoreForPlayers } from "@/lib/scoring";

export async function createEvent(groupId: string, createdBy: string, name: string, date: string): Promise<string> {
  const id = randomUUID();
  await db.insert(events).values({ id, groupId, name, date, createdBy });
  return id;
}

export type GroupEventSummary = { id: string; name: string; date: string; gamesCount: number };

/** A crew's past events, newest first — for the "Crew nights" list on the
 * crew detail page. */
export async function getGroupEvents(groupId: string): Promise<GroupEventSummary[]> {
  const eventRows = await db.query.events.findMany({
    where: eq(events.groupId, groupId),
    with: { games: true },
  });
  return eventRows
    .map((e) => ({ id: e.id, name: e.name, date: e.date, gamesCount: e.games.length }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export type EventStanding = { userIds: string[]; names: string; wins: number; losses: number; points: number };
export type EventGame = {
  id: string;
  playedAt: Date;
  matType: "2" | "4" | "8";
  teams: { id: string; label: string; finalRank: number | null; playerNames: string[] }[];
};
export type EventDetail = {
  id: string;
  name: string;
  date: string;
  groupId: string | null;
  groupName: string | null;
  games: EventGame[];
  standings: EventStanding[];
};

/** Everything the event view needs: the night's games plus a duo standings
 * table (ranked by points, mirroring stats-logic.ts's `f.event` branch of
 * `computeRankedList`, which slices the same shape client-side on the
 * Stats page). */
export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), with: { group: true } });
  if (!event) return null;

  const eventGames = await db.query.games.findMany({
    where: eq(games.eventId, eventId),
    with: { teams: { with: { players: { with: { user: true, shots: true } } } } },
  });

  const standingsByDuo = new Map<string, EventStanding>();
  for (const g of eventGames) {
    for (const t of g.teams) {
      const userIds = [...t.players.map((p) => p.userId)].sort();
      const key = userIds.join("+");
      const names = t.players.map((p) => p.user.name?.split(" ")[0] ?? "Player").join(" & ");
      const entry = standingsByDuo.get(key) ?? { userIds, names, wins: 0, losses: 0, points: 0 };
      if (t.finalRank === 1) entry.wins++;
      else entry.losses++;
      entry.points += scoreForPlayers(t.players);
      standingsByDuo.set(key, entry);
    }
  }

  return {
    id: event.id,
    name: event.name,
    date: event.date,
    groupId: event.groupId,
    groupName: event.group?.name ?? null,
    games: eventGames.map((g) => ({
      id: g.id,
      playedAt: g.playedAt,
      matType: g.matType,
      teams: [...g.teams]
        .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))
        .map((t) => ({
          id: t.id,
          label: t.teamLabel,
          finalRank: t.finalRank,
          playerNames: t.players.map((p) => p.user.name ?? "Player"),
        })),
    })),
    standings: [...standingsByDuo.values()].sort((a, b) => b.points - a.points),
  };
}
