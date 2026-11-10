/**
 * Game permissions
 *
 * Who may delete a logged game and who may correct its kruip afterwards.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTeams, groups, users } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/admin";

/** Who may delete a game: whoever logged it, the crew owner, or an app admin. */
export async function canDeleteGame(game: { createdBy: string; groupId: string | null }, userId: string) {
  if (game.createdBy === userId) return true;
  const [crew, me] = await Promise.all([
    game.groupId ? db.query.groups.findFirst({ where: eq(groups.id, game.groupId), columns: { createdBy: true } }) : null,
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } }),
  ]);
  return crew?.createdBy === userId || isAdminEmail(me?.email);
}

/** Who may correct a game's kruip after logging: its players, plus whoever
 * may delete the game (logger, crew owner, admin). */
export async function canEditKruip(game: { id: string; createdBy: string; groupId: string | null }, userId: string) {
  const played = await db.query.gameTeams.findMany({ where: eq(gameTeams.gameId, game.id), with: { players: { columns: { userId: true } } } });
  if (played.some((tm) => tm.players.some((p) => p.userId === userId))) return true;
  return canDeleteGame(game, userId);
}
