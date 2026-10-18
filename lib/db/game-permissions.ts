import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, users } from "@/lib/db/schema";
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
