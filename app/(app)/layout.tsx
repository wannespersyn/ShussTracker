/**
 * App shell layout
 *
 * Route group (app): every signed-in screen. Redirects to onboarding without
 * a session, renders the bottom nav, and paints the remembered crew's game
 * theme (`data-game`, lib/rules.ts) so BeerToss crews get their own accent.
 * Data: the theme comes from a cross-request cache, so no DB round trip on
 * a normal navigation.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRememberedCrewId } from "@/lib/active-crew";
import { getCrewTheme } from "@/lib/db/crew-insights";
import { BottomNav } from "@/components/layout/BottomNav";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/onboarding");
  const crewId = await getRememberedCrewId();
  const theme = crewId && UUID.test(crewId) ? await getCrewTheme(crewId) : "leberschuss";

  return (
    <div className="flex-1 flex flex-col" data-game={theme}>
      {children}
      <BottomNav currentUserId={session.user.id} />
    </div>
  );
}
