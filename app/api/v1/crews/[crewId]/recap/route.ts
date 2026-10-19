/**
 * GET /api/v1/crews/[crewId]/recap
 *
 * Both recaps the website shows: `monthly` — the viewer's six "your month"
 * story slides (null when they didn't play this or last month) — and
 * `season`, the crew's season-so-far numbers. Text is in the request language.
 */
import { api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { getCrewRecap } from "@/lib/db/recap";
import { buildMonthlyRecap } from "@/lib/monthly-recap";
import { getLocale, getT } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ crewId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  const crew = await getCrew(crewId);
  if (!crew) throw notFound();
  const [insights, season, t, locale] = await Promise.all([getCrewInsights(crewId), getCrewRecap(crewId), getT(), getLocale()]);
  const monthly = buildMonthlyRecap(insights, userId, crew.name, new Date(), t, locale);
  return { crewName: crew.name, monthly, season: { ...season, label: season.label === "All-time" ? t.season.allTime : season.label } };
});
