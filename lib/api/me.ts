/**
 * API user summary
 *
 * The signed-in user as the app sees them: profile basics, their crews and
 * their beta switches (Settings › Beta).
 * Returned by GET /api/v1/me and by both sign-in endpoints.
 *
 * Exports: getMe
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUserCrews } from "@/lib/db/crew-insights";
import { isAdminEmail } from "@/lib/admin";
import { ApiError } from "@/lib/api/http";
import { getBetaState } from "@/lib/db/beta";
import { BETA_FEATURES, betaEnabled, newBetaCount } from "@/lib/beta";

export async function getMe(userId: string) {
  const [user, crews, beta] = await Promise.all([db.query.users.findFirst({ where: eq(users.id, userId) }), getUserCrews(userId), getBetaState(userId)]);
  if (!user) throw new ApiError(401, "unauthorized", "Not signed in");
  return {
    user: { id: user.id, name: user.name, email: user.email, image: user.image, isAdmin: isAdminEmail(user.email) },
    crews: crews.map((c) => ({ ...c, isOwner: c.createdBy === userId })),
    beta: {
      optIn: beta.optIn,
      newCount: newBetaCount(beta),
      features: Object.fromEntries(BETA_FEATURES.map((f) => [f.key, betaEnabled(beta, f.key)])) as Record<(typeof BETA_FEATURES)[number]["key"], boolean>,
      disabled: beta.disabled,
    },
  };
}
