import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, feedbackVotes, gameComments, gameReactions, groupMembers, groups, sessions, users } from "@/lib/db/schema";

export const FORMER_PLAYER = "Former player";

/**
 * Deletes a user's account (App Store guideline 5.1.1(v)).
 *
 * Their personal data goes — name, email, avatar, Google link, sessions,
 * comments, reactions, votes, crew memberships — but the games they played
 * stay, credited to an anonymous "Former player", so their crewmates'
 * records, Elo and duo stats don't change. Crews they own pass to the most
 * active remaining member; a crew with nobody left is deleted.
 */
export async function deleteAccount(userId: string) {
  const owned = await db.query.groups.findMany({ where: eq(groups.createdBy, userId), columns: { id: true } });
  for (const crew of owned) {
    const res = await db.execute(sql`
      select m.user_id as id
      from "group_member" m join "user" u on u.id = m.user_id
      where m.group_id = ${crew.id} and m.user_id <> ${userId} and not u.is_guest
      order by (
        select count(*) from "game_team_player" p
        join "game_team" t on t.id = p.game_team_id
        join "game" g on g.id = t.game_id
        where p.user_id = m.user_id and g.group_id = ${crew.id}
      ) desc, m.joined_at asc
      limit 1
    `);
    const heir = (res.rows[0] as { id: string } | undefined)?.id;
    if (heir) await db.update(groups).set({ createdBy: heir }).where(eq(groups.id, crew.id));
    else await db.delete(groups).where(eq(groups.id, crew.id));
  }

  await db.delete(gameComments).where(eq(gameComments.userId, userId));
  await db.delete(gameReactions).where(eq(gameReactions.userId, userId));
  await db.delete(feedbackVotes).where(eq(feedbackVotes.userId, userId));
  await db.delete(groupMembers).where(eq(groupMembers.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.execute(sql`delete from "push_subscription" where user_id = ${userId}`).catch(() => {});
  await db.execute(sql`delete from "app_push_token" where user_id = ${userId}`).catch(() => {});
  await db
    .update(users)
    .set({ name: FORMER_PLAYER, email: null, emailVerified: null, image: null, isGuest: true, claimToken: null })
    .where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
