/**
 * Crew tournaments — Route: /crews/[crewId]/tournaments
 *
 * Every tournament of the crew, brackets and Americano / Mexicano: the ones
 * running now, then the finished ones with their winner. Requires crew
 * membership.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrew } from "@/lib/db/crew-insights";
import { getCrewEvents } from "@/lib/db/crew-events";
import { getLocale, getT } from "@/lib/i18n/server";
import { Kicker, Screen } from "@/components/v2";
import { CrewEventRow, NewEventButtons } from "@/components/crews/CrewEvents";

export default async function CrewTournamentsPage({ params }: Readonly<{ params: Promise<{ crewId: string }> }>) {
  const { crewId } = await params;
  const session = await requireSession();
  try {
    await requireGroupMember(session.user.id, crewId);
  } catch {
    notFound();
  }
  const [crew, events, t, locale] = await Promise.all([getCrew(crewId), getCrewEvents(crewId, { limit: 100 }), getT(), getLocale()]);
  if (!crew) notFound();
  const date = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" });
  const live = events.filter((e) => e.live);
  const done = events.filter((e) => !e.live);

  return (
    <Screen className="gap-4">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/crews/${crewId}`}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 min-w-0 flex flex-col">
          <h1 className="font-display font-extrabold text-[26px] leading-none uppercase">{t.ev.pageTitle}</h1>
          <span className="font-body text-xs text-muted truncate">{crew.name}</span>
        </span>
      </header>
      <NewEventButtons crewId={crewId} ev={t.ev} />
      {events.length === 0 && <p className="font-body text-sm text-muted">{t.ev.none}</p>}
      {live.length > 0 && (
        <section aria-label={t.ev.running} className="flex flex-col gap-2">
          <Kicker>{t.ev.running}</Kicker>
          {live.map((e) => (
            <CrewEventRow key={e.id} e={e} ev={t.ev} date={date.format(e.createdAt)} />
          ))}
        </section>
      )}
      {done.length > 0 && (
        <section aria-label={t.ev.finished} className="flex flex-col gap-2">
          <Kicker>{t.ev.finished}</Kicker>
          {done.map((e) => (
            <CrewEventRow key={e.id} e={e} ev={t.ev} date={date.format(e.createdAt)} />
          ))}
        </section>
      )}
    </Screen>
  );
}
