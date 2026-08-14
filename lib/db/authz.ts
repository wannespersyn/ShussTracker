import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { groupMembers, groups } from "@/lib/db/schema";

/**
 * App-layer authorization. Neon/Auth.js has no equivalent of Supabase's
 * RLS + `auth.uid()` JWT claim flowing into the Postgres session, so every
 * data-access function that touches group/game/shot data must call one of
 * these guards itself before querying — the database will not enforce it.
 */

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Returns the signed-in user's id, or throws UnauthorizedError. For use in
 * server actions / data-access code, where a thrown error is appropriate. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/** Returns the signed-in session, or redirects to /onboarding. For use at
 * the top of page components — the (app) layout already guards signed-out
 * access, but each page re-checks rather than trusting that a session seen
 * a moment earlier in the layout is still there by the time the page's own
 * `auth()` call resolves. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/onboarding");
  return session;
}

/** Throws ForbiddenError unless the given user is a member of the group. */
export async function requireGroupMember(userId: string, groupId: string) {
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);

  if (!membership) throw new ForbiddenError("Not a member of this crew");
}

/** Throws ForbiddenError unless the given user created (owns) the group. */
export async function requireGroupOwner(userId: string, groupId: string) {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.createdBy, userId)))
    .limit(1);

  if (!group) throw new ForbiddenError("Only the crew owner can do this");
}

/** Teams are always exactly 2 players — enforced here, not by the DB. */
export function assertTwoPlayersPerTeam(playerIds: readonly string[]) {
  if (playerIds.length !== 2) {
    throw new Error(
      `A team must have exactly 2 players, got ${playerIds.length}`,
    );
  }
}
