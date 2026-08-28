import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runAtomic } from "@/lib/db/batch";
import { users, groupMembers, gameTeamPlayers, tournamentEntrants, rivalries } from "@/lib/db/schema";
import { generateCode } from "@/lib/codes";

async function generateUniqueClaimCode(): Promise<string> {
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.query.users.findFirst({ where: eq(users.claimToken, code) });
    if (!existing) break;
    code = generateCode();
  }
  return code;
}

/** A guest is a normal `user` row — games, shots, and every stat query
 * work on them unchanged — just with no email/account and a claim code
 * instead. Whoever added them can hand that code to the actual person once
 * they're ready to sign up for real (see claimGuest). */
export async function addGuestPlayer(groupId: string, name: string): Promise<{ userId: string; claimToken: string }> {
  const userId = randomUUID();
  const claimToken = await generateUniqueClaimCode();
  await runAtomic((executor) => [
    executor.insert(users).values({ id: userId, name, isGuest: true, claimToken }),
    executor.insert(groupMembers).values({ groupId, userId }),
  ]);
  return { userId, claimToken };
}

export type GuestInfo = { id: string; name: string; claimToken: string | null };

export async function getCrewGuests(groupId: string): Promise<GuestInfo[]> {
  const rows = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    with: { user: true },
  });
  return rows
    .filter((r) => r.user.isGuest)
    .map((r) => ({ id: r.user.id, name: r.user.name ?? "Guest", claimToken: r.user.claimToken }));
}

/** Looks up an unclaimed guest by their claim code (case/whitespace
 * insensitive, matching how crew invite codes are entered). */
export async function findGuestByClaimCode(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const user = await db.query.users.findFirst({ where: eq(users.claimToken, code) });
  return user?.isGuest ? user : null;
}

export async function removeGuestPlayer(guestId: string) {
  await db.delete(users).where(eq(users.id, guestId));
}

/** Merges a guest's history onto a real, signed-in account: every FK that
 * points at the guest's user id gets repointed at the claimer's id, the
 * guest's own crew memberships are dropped in favor of the claimer's
 * (joining any crew they weren't already in), and the now-empty guest row
 * is deleted. One `runAtomic` call — every statement is built up front
 * rather than branching on an intermediate result (see lib/db/games.ts's
 * createGameRecord for the same pattern). A guest who happened to already
 * share a game-team with the claimer (vanishingly unlikely — the player
 * picker never lets you pick the same person twice) would hit
 * gameTeamPlayers' unique constraint here; that's an acceptable, visible
 * failure for how rare it is, not one worth special-casing. */
export async function claimGuest(guestId: string, realUserId: string) {
  const [guestGroups, realGroups] = await Promise.all([
    db.query.groupMembers.findMany({ where: eq(groupMembers.userId, guestId) }),
    db.query.groupMembers.findMany({ where: eq(groupMembers.userId, realUserId) }),
  ]);
  const realGroupIds = new Set(realGroups.map((g) => g.groupId));
  const groupsToJoin = guestGroups.filter((g) => !realGroupIds.has(g.groupId));

  await runAtomic((executor) => [
    executor.delete(groupMembers).where(eq(groupMembers.userId, guestId)),
    ...(groupsToJoin.length > 0
      ? [executor.insert(groupMembers).values(groupsToJoin.map((g) => ({ groupId: g.groupId, userId: realUserId })))]
      : []),
    executor.update(gameTeamPlayers).set({ userId: realUserId }).where(eq(gameTeamPlayers.userId, guestId)),
    executor.update(tournamentEntrants).set({ player1Id: realUserId }).where(eq(tournamentEntrants.player1Id, guestId)),
    executor.update(tournamentEntrants).set({ player2Id: realUserId }).where(eq(tournamentEntrants.player2Id, guestId)),
    executor.update(rivalries).set({ aPlayer1Id: realUserId }).where(eq(rivalries.aPlayer1Id, guestId)),
    executor.update(rivalries).set({ aPlayer2Id: realUserId }).where(eq(rivalries.aPlayer2Id, guestId)),
    executor.update(rivalries).set({ bPlayer1Id: realUserId }).where(eq(rivalries.bPlayer1Id, guestId)),
    executor.update(rivalries).set({ bPlayer2Id: realUserId }).where(eq(rivalries.bPlayer2Id, guestId)),
    executor.delete(users).where(eq(users.id, guestId)),
  ]);
}
