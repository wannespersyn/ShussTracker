/**
 * Active crew
 *
 * The crew the viewer chose to look at (home, wrapped, stats, duos), kept
 * in a cookie so it sticks instead of jumping to wherever the last game was
 * played. Falls back to the most active crew.
 */
import { cookies } from "next/headers";
import { getUserCrews, type UserCrew } from "@/lib/db/crew-insights";

export const ACTIVE_CREW_COOKIE = "crew";

/** The viewer's crews plus the one to show: `?crew=` param, then the
 * remembered choice, then the most active crew. */
export async function getActiveCrew(userId: string, param?: string | null): Promise<{ crews: UserCrew[]; crew: UserCrew | undefined }> {
  const [crews, jar] = await Promise.all([getUserCrews(userId), cookies()]);
  const remembered = jar.get(ACTIVE_CREW_COOKIE)?.value;
  const crew = crews.find((c) => c.id === param) ?? crews.find((c) => c.id === remembered) ?? crews[0];
  return { crews, crew };
}

/** The remembered crew id (unvalidated) — for pages that rank crews themselves. */
export async function getRememberedCrewId(): Promise<string | undefined> {
  return (await cookies()).get(ACTIVE_CREW_COOKIE)?.value;
}
