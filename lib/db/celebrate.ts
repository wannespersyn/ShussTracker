/**
 * Beta celebrations: what to celebrate for one viewer on one game. Replays
 * the crew history up to just before and just after the game, and compares
 * the viewer's Elo, streak, rank and achievements. Only for winners of a
 * recent game; callers check the beta flag. Carries what the Animaties
 * designs show: Elo before/after, the ranking rows around you, achievement
 * progress and how rare it is in the crew.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { getCrewHistory, getCrew } from "@/lib/db/crew-insights";
import { buildCrewInsights, firstName } from "@/lib/insights";
import { achievementsFor, type AchievementIcon } from "@/lib/achievements-v2";
import { getT } from "@/lib/i18n/server";

export type RankRow = { rank: number; name: string; initial: string; elo: number; me: boolean };

export type CelebrationMoment =
  | { kind: "win"; elo: number; before: number; after: number; team: string }
  | { kind: "streak"; n: number; record: boolean; team: string; crew: string }
  | { kind: "climb"; from: number; to: number; crew: string; rows: RankRow[]; oldSlot: number; newSlot: number; eloBefore: number; eloAfter: number }
  | { kind: "achievement"; name: string; desc: string; icon: AchievementIcon; have: number; need: number; before: number; rarity: number };

const RECENT_MS = 12 * 3600 * 1000;
const MAX_MOMENTS = 3;
const ROWS = 6;

export async function getCelebration(gameId: string, userId: string, now = Date.now()): Promise<CelebrationMoment[]> {
  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
    columns: { id: true, groupId: true, playedAt: true },
    with: { teams: { columns: { finalRank: true }, with: { players: { columns: { userId: true } } } } },
  });
  if (!game?.groupId || game.teams.length < 2) return [];
  if (now - game.playedAt.getTime() > RECENT_MS) return [];
  const myTeam = game.teams.find((t) => t.finalRank === 1 && t.players.some((p) => p.userId === userId));
  if (!myTeam) return [];

  const [cached, crew, t] = await Promise.all([getCrewHistory(game.groupId), getCrew(game.groupId), getT()]);
  // A just-logged game may not be in the cached history yet: read it fresh then.
  const history = cached.games.some((g) => g.id === gameId) ? cached : await getCrewHistory(game.groupId, { fresh: true });
  const sorted = [...history.games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const idx = sorted.findIndex((g) => g.id === gameId);
  if (idx < 0) return [];
  const at = new Date(game.playedAt.getTime() + 1);
  const before = buildCrewInsights(history.members, sorted.slice(0, idx), at);
  const after = buildCrewInsights(history.members, sorted.slice(0, idx + 1), at);
  const meBefore = before.players.find((p) => p.userId === userId);
  const meAfter = after.players.find((p) => p.userId === userId);
  if (!meAfter) return [];

  const crewName = crew?.name ?? "";
  const nameOf = (id: string | null) => firstName(after.players.find((p) => p.userId === id)?.name ?? history.members.find((m) => m.id === id)?.name ?? "?");
  const team = myTeam.players.map((p) => nameOf(p.userId)).join(" & ");
  const delta = Math.round(after.gameElo[gameId]?.[userId] ?? 0);
  const eloAfter = Math.round(meAfter.elo);
  const eloBefore = meBefore ? Math.round(meBefore.elo) : eloAfter - delta;

  const moments: CelebrationMoment[] = [{ kind: "win", elo: delta, before: eloBefore, after: eloAfter, team }];

  if (meAfter.streak?.kind === "W" && meAfter.streak.n >= 3) {
    const crewBest = Math.max(0, ...before.players.map((p) => p.bestWinStreak));
    // Personal streak: only the viewer's name, not the duo.
    moments.push({ kind: "streak", n: meAfter.streak.n, record: meAfter.streak.n > crewBest, team: nameOf(userId), crew: crewName });
  }

  if (meBefore && meAfter.rank < meBefore.rank) {
    const list = [...after.players].sort((a, b) => a.rank - b.rank);
    const len = Math.min(ROWS, list.length);
    const ni = meAfter.rank - 1;
    const oi = Math.min(meBefore.rank - 1, list.length - 1);
    let start = Math.max(0, Math.min(ni - 1, list.length - len));
    if (oi > start + len - 1) start = Math.max(0, Math.min(ni, oi - len + 1));
    const rows = list.slice(start, start + len).map((p) => ({
      rank: p.rank,
      name: firstName(p.name),
      initial: firstName(p.name).slice(0, 1).toUpperCase(),
      elo: Math.round(p.elo),
      me: p.userId === userId,
    }));
    moments.push({
      kind: "climb",
      from: meBefore.rank,
      to: meAfter.rank,
      crew: crewName,
      rows,
      newSlot: ni - start,
      oldSlot: Math.min(oi - start, len - 1),
      eloBefore,
      eloAfter,
    });
  }

  if (meBefore) {
    const ctx = (i: typeof before) => ({ duos: i.duos, sessions: i.sessions, reactions: 0, crewName, now: at });
    const prev = achievementsFor(meBefore, ctx(before), t);
    const had = new Set(prev.filter((a) => a.got).map((a) => a.id));
    const fresh = achievementsFor(meAfter, ctx(after), t).find((a) => a.got && !had.has(a.id));
    if (fresh) {
      const holders = after.players.filter((p) => achievementsFor(p, ctx(after), t).some((a) => a.id === fresh.id && a.got)).length;
      moments.push({
        kind: "achievement",
        name: fresh.name,
        desc: fresh.desc,
        icon: fresh.icon,
        have: Math.min(fresh.have, fresh.need),
        need: fresh.need,
        before: Math.min(prev.find((a) => a.id === fresh.id)?.have ?? 0, fresh.need),
        rarity: after.players.length ? Math.round((holders / after.players.length) * 100) : 100,
      });
    }
  }

  return moments.slice(0, MAX_MOMENTS);
}
