/**
 * App shell layout
 *
 * Route group (app): every signed-in screen. Redirects to onboarding without
 * a session, renders the bottom nav, and paints the active crew's game theme
 * (`data-game`, lib/rules.ts) so BeerToss crews get their own accent colour.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveCrew } from "@/lib/active-crew";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/onboarding");
  const { crew } = await getActiveCrew(session.user.id);

  return (
    <div className="flex-1 flex flex-col" data-game={crew?.rules.theme ?? "leberschuss"}>
      {children}
      <BottomNav currentUserId={session.user.id} />
    </div>
  );
}
