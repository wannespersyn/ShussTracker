/**
 * Crew insights (shared)
 *
 * Re-exports the website's lib/insights.ts (crew history replay: ranks,
 * Elo, duos, nights) so shared modules like @shared/records and
 * @shared/wrapped resolve "@/lib/insights" inside the app.
 */
export * from "../../../lib/insights";
