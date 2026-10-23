/**
 * Shussapp Wrapped (beta): the season story for the signed-in player in
 * their most active crew (or ?crewId=). Not in the beta → its explainer;
 * fewer than 10 season games → a "play N more" screen.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/db/authz";
import { hasBeta } from "@/lib/db/beta";
import { getUserCrews } from "@/lib/db/crew-insights";
import { getWrapped } from "@/lib/db/wrapped";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { Screen } from "@/components/v2";
import { BackLink } from "@/components/beta/BetaUi";
import { WrappedPlayer } from "@/components/beta/WrappedPlayer";

export const metadata = { title: "Wrapped · Shussapp" };

export default async function WrappedPage({ searchParams }: Readonly<{ searchParams: Promise<{ crewId?: string }> }>) {
  const session = await requireSession();
  const userId = session.user.id;
  if (!(await hasBeta(userId, "wrapped"))) redirect("/settings/beta/wrapped");
  const [{ crewId }, crews, t] = await Promise.all([searchParams, getUserCrews(userId), getT()]);
  const crew = crews.find((c) => c.id === crewId) ?? crews[0];
  const closeHref = `/players/${userId}`;
  const W = t.beta.wrapped;

  const result = crew ? await getWrapped(userId, { id: crew.id, name: crew.name }) : { ready: false as const, games: 0, need: 10 };
  if (!result.ready) {
    return (
      <Screen nav={false} className="gap-5 pb-8">
        <header className="flex items-center h-11">
          <BackLink href={closeHref} label={t.common.back} />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <span className="font-heading font-bold text-[12px] tracking-[0.16em] text-muted">{W.kicker}</span>
          <h1 className="font-display font-extrabold text-[52px] leading-[0.9] uppercase">{W.notEnoughTitle}</h1>
          <p className="max-w-72 font-body text-[15px] leading-[1.5] text-soft">{format(W.notEnoughBody, { n: result.need - result.games })}</p>
          <div className="mt-3 w-60 h-2.5 rounded-pill bg-chip overflow-hidden" aria-hidden="true">
            <div className="h-full bg-amber" style={{ width: `${Math.round((result.games / result.need) * 100)}%` }} />
          </div>
          <span className="font-display font-extrabold text-xl">
            {result.games} / {result.need}
          </span>
        </div>
        <Link href="/log" className="h-14 rounded-pill bg-amber flex items-center justify-center font-body font-bold text-base" style={{ color: "#111" }}>
          {t.nav.log}
        </Link>
      </Screen>
    );
  }

  return <WrappedPlayer data={result.data} closeHref={closeHref} />;
}
