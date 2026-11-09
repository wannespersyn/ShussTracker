/**
 * Active crew actions
 *
 * Remembers which crew the viewer wants to look at (cookie), after checking
 * they're a member. The form variant redirects back to the page it came from.
 */
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/db/authz";
import { getUserCrews } from "@/lib/db/crew-insights";
import { ACTIVE_CREW_COOKIE } from "@/lib/active-crew";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Stores the choice; returns false when the viewer isn't in that crew. */
export async function rememberCrewAction(crewId: string): Promise<boolean> {
  const userId = await requireUserId();
  const crews = await getUserCrews(userId);
  if (!crews.some((c) => c.id === crewId)) return false;
  (await cookies()).set(ACTIVE_CREW_COOKIE, crewId, { maxAge: ONE_YEAR, path: "/", sameSite: "lax" });
  return true;
}

/** Form action for the crew switcher: `crewId` + `next` (an in-app path). */
export async function switchCrewAction(formData: FormData) {
  const crewId = String(formData.get("crewId") ?? "");
  const nextRaw = String(formData.get("next") ?? "/home");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/home";
  await rememberCrewAction(crewId);
  revalidatePath("/", "layout");
  redirect(next);
}
