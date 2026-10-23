/**
 * Loads a player's Wrapped (beta) for one crew and the current season:
 * the season slice of the crew history → lib/wrapped.ts, plus the three
 * game photos with the most reactions. Callers authorize + check the flag.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCrewHistory } from "@/lib/db/crew-insights";
import { computeWrapped, seasonFor, WRAPPED_MIN_GAMES, type WrappedStats } from "@/lib/wrapped";
import { photoSrc } from "@/lib/photo";

export type WrappedHighlight = { gameId: string; src: string; reactions: number; playedAt: string };
export type WrappedData = WrappedStats & { highlights: WrappedHighlight[] };

export async function getWrapped(
  userId: string,
  crew: { id: string; name: string },
  now = new Date(),
): Promise<{ ready: true; data: WrappedData } | { ready: false; games: number; need: number }> {
  const season = seasonFor(now);
  const history = await getCrewHistory(crew.id);
  const seasonGames = history.games.filter((g) => g.playedAt >= season.start && g.playedAt < season.end);
  const mine = seasonGames.filter((g) => g.teams.some((t) => t.rank != null && t.players.some((p) => p.id === userId))).length;
  if (mine < WRAPPED_MIN_GAMES) return { ready: false, games: mine, need: WRAPPED_MIN_GAMES };

  const stats = computeWrapped(userId, history.members, seasonGames, { crewName: crew.name, season, now });
  if (!stats) return { ready: false, games: mine, need: WRAPPED_MIN_GAMES };

  const photos = await db.execute(sql`
    select g.id, g.photo_url, g.played_at, count(r.id)::int as reactions
    from "game" g
    left join "game_reaction" r on r.game_id = g.id
    where g.group_id = ${crew.id}
      and g.photo_url is not null
      and g.played_at >= ${season.start.toISOString()} and g.played_at < ${season.end.toISOString()}
      and exists (
        select 1 from "game_team" t join "game_team_player" p on p.game_team_id = t.id
        where t.game_id = g.id and p.user_id = ${userId}
      )
    group by g.id
    order by reactions desc, g.played_at desc
    limit 3
  `);
  const highlights = (photos.rows as { id: string; photo_url: string; played_at: string | Date; reactions: number }[]).map((r) => ({
    gameId: r.id,
    src: photoSrc(r.id, r.photo_url),
    reactions: r.reactions,
    playedAt: new Date(r.played_at).toISOString(),
  }));
  return { ready: true, data: { ...stats, highlights } };
}
