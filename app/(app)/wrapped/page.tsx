/**
 * Shussapp Wrapped (beta): the season story for the signed-in player in
 * one crew. In 2+ crews you pick the crew first (?crewId=); with one crew
 * it starts straight away. Not in the beta → its explainer;
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
  const [{ crewId }, t] = await Promise.all([searchParams, getT()]);
  const crews = await getUserCrews(userId);
  const crew = crews.find((c) => c.id === crewId) ?? (crews.length === 1 ? crews[0] : undefined);
  const closeHref = `/players/${userId}`;
  const W = t.beta.wrapped;

  // In 2+ crews: choose which crew's Wrapped to watch before it starts.
  if (!crew && crews.length > 1) {
    return (
      <Screen nav={false} className="gap-5 pb-8">
        <header className="flex items-center h-11">
          <BackLink href={closeHref} label={t.common.back} />
        </header>
        <div className="flex flex-col gap-2">
          <span className="font-heading font-bold text-[12px] tracking-[0.16em] text-muted">{W.kicker}</span>
          <h1 className="font-display font-extrabold text-[44px] leading-[0.9] uppercase">{W.pickCrew}</h1>
        </div>
        <div className="flex flex-col gap-2">
          {crews.map((c) => (
            <Link
              key={c.id}
              href={`/wrapped?crewId=${c.id}`}
              className="flex items-center gap-3 px-3.5 py-3.5 rounded-[16px] bg-surface-deep border border-line text-cream"
            >
              <span className="w-11 h-11 shrink-0 rounded-md bg-surface-raised text-gold flex items-center justify-center font-display font-extrabold text-base uppercase">
                {c.name.slice(0, 2)}
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-body font-semibold text-[15px] truncate">{c.name}</span>
                <span className="font-body text-xs text-muted">{format(W.crewGames, { n: c.games })}</span>
              </span>
              <span className="font-heading font-extrabold text-sm tracking-[0.1em] text-gold">{W.watch}</span>
            </Link>
          ))}
        </div>
      </Screen>
    );
  }
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

  return <WrappedPlayer data={result.data} closeHref={crews.length > 1 ? "/wrapped" : closeHref} />;
}
