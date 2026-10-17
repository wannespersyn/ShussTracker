import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { achievementsFor } from "@/lib/achievements-v2";

/** v2 achievements for a player, scoped to their most active crew. */
export async function getPlayerAchievements(userId: string, now: Date) {
  const crews = await getUserCrews(userId);
  const crew = crews[0];
  if (!crew) return [];
  const [insights, reactionRes] = await Promise.all([
    getCrewInsights(crew.id),
    db.execute(sql`
      select count(*)::int as n from "game_reaction" r
      where r.game_id in (
        select t.game_id from "game_team" t join "game_team_player" p on p.game_team_id = t.id where p.user_id = ${userId}
      ) and r.user_id <> ${userId}
    `),
  ]);
  const p = insights.players.find((x) => x.userId === userId);
  if (!p) return [];
  const reactions = Number((reactionRes.rows[0] as { n: number } | undefined)?.n ?? 0);
  return achievementsFor(p, { duos: insights.duos, sessions: insights.sessions, reactions, crewName: crew.name, now });
}
