/**
 * POST /api/v1/beta/feedback
 *
 * Beta feedback from the app: `{ feature, rating?, tags?, text? }` — the
 * full sheet, or a quick thumbs (`rating` 4 / 1). `feature` is a beta key or
 * "beta" for the beta as a whole. Same storage as the website.
 */
import { api, badRequest, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { submitBetaFeedback } from "@/lib/db/beta";
import { BETA_GENERAL, BETA_TAGS, isBetaKey } from "@/lib/beta";
import { getUserCrews } from "@/lib/db/crew-insights";

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  const feature = isBetaKey(body.feature) ? body.feature : BETA_GENERAL;
  const r = Number(body.rating);
  const rating = Number.isInteger(r) && r >= 1 && r <= 4 ? r : null;
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string" && (BETA_TAGS as readonly string[]).includes(t)) : [];
  const note = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (rating === null && tags.length === 0 && !note) throw badRequest("Send a rating, tags or text");
  const text = [tags.length ? `[${tags.join(", ")}]` : "", note].filter(Boolean).join(" ") || (rating === 4 ? "(thumbs up)" : rating === 1 ? "(thumbs down)" : "(score)");
  const groupId = (await getUserCrews(userId))[0]?.id ?? null;
  await submitBetaFeedback({ userId, groupId, feature, rating, text });
  return Response.json({ ok: true }, { status: 201 });
});
