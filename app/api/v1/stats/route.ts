/**
 * GET /api/v1/stats
 *
 * The raw payload behind Deep stats (games with per-player shot zones,
 * people and crews); the app slices it by who / mat / period on the device,
 * like the website does.
 */
import { api } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { getStatsExplorerData } from "@/lib/db/stats";

export const GET = api(async (req) => getStatsExplorerData(await requireApiUser(req)));
