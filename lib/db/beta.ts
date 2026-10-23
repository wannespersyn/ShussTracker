/**
 * Beta data access: per-user opt-in and feature switches, beta feedback
 * (stored in the shared `feedback` table with `feature` + `rating` set) and
 * the admin roll-up. Callers authorize first; these functions trust the
 * userId they get.
 */
import { cache } from "react";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedback, users } from "@/lib/db/schema";
import { betaEnabled, type BetaKey, type BetaState } from "@/lib/beta";

/** One read per request, however many components ask. */
export const getBetaState = cache(async (userId: string): Promise<BetaState> => {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { betaOptIn: true, betaJoinedAt: true, betaDisabled: true },
  });
  return { optIn: row?.betaOptIn ?? false, joinedAt: row?.betaJoinedAt ?? null, disabled: row?.betaDisabled ?? [] };
});

/** Gate for feature code: true only if the user is in the beta and hasn't
 * switched this feature off. */
export async function hasBeta(userId: string, key: BetaKey): Promise<boolean> {
  return betaEnabled(await getBetaState(userId), key);
}

/** Joining resets `betaJoinedAt` so the "new" badge only counts features
 * added since; leaving keeps it, which is how admin counts "left". */
export async function setBetaOptIn(userId: string, on: boolean) {
  await db
    .update(users)
    .set(on ? { betaOptIn: true, betaJoinedAt: new Date() } : { betaOptIn: false })
    .where(eq(users.id, userId));
}

export async function setBetaFeature(userId: string, key: BetaKey, on: boolean) {
  await db
    .update(users)
    .set({
      betaDisabled: on
        ? sql`array_remove(${users.betaDisabled}, ${key})`
        : sql`array_append(array_remove(${users.betaDisabled}, ${key}), ${key})`,
    })
    .where(eq(users.id, userId));
}

export async function submitBetaFeedback(input: {
  userId: string;
  groupId?: string | null;
  feature: string;
  rating: number | null;
  text: string;
}) {
  await db.insert(feedback).values({
    userId: input.userId,
    groupId: input.groupId ?? null,
    type: "other",
    feature: input.feature,
    rating: input.rating,
    text: input.text,
  });
}

export type BetaFeatureStats = { feature: string; responses: number; avgRating: number | null; positive: number; rated: number; switchedOff: number };

/** Admin roll-up: participation, per-feature scores and the latest responses. */
export async function getBetaAdminStats() {
  const [people, perFeature, off, recent] = await Promise.all([
    db.execute(sql`
      select
        (select count(*) from "user" where not is_guest)::int as users,
        (select count(*) from "user" where beta_opt_in)::int as participants,
        (select count(*) from "user" where not beta_opt_in and beta_joined_at is not null)::int as left_beta
    `),
    db.execute(sql`
      select feature,
        count(*)::int as responses,
        count(rating)::int as rated,
        avg(rating)::float as avg_rating,
        count(*) filter (where rating >= 3)::int as positive
      from "feedback" where feature is not null
      group by feature
    `),
    db.execute(sql`
      select k as feature, count(*)::int as n
      from "user", unnest(beta_disabled) as k
      where beta_opt_in
      group by k
    `),
    db.query.feedback.findMany({
      where: isNotNull(feedback.feature),
      with: { user: true },
      orderBy: desc(feedback.createdAt),
      limit: 40,
    }),
  ]);
  const p = people.rows[0] as { users: number; participants: number; left_beta: number };
  const offBy = new Map((off.rows as { feature: string; n: number }[]).map((r) => [r.feature, r.n]));
  const features: BetaFeatureStats[] = (perFeature.rows as { feature: string; responses: number; rated: number; avg_rating: number | null; positive: number }[]).map((r) => ({
    feature: r.feature,
    responses: r.responses,
    rated: r.rated,
    avgRating: r.avg_rating,
    positive: r.positive,
    switchedOff: offBy.get(r.feature) ?? 0,
  }));
  return { users: p.users, participants: p.participants, left: p.left_beta, features, offBy, recent };
}
