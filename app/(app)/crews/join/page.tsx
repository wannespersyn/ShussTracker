import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/db/authz";
import { joinCrewByCode } from "@/lib/db/crews";
import { getUserCrews } from "@/lib/db/crew-insights";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import { JoinCrewForm } from "@/components/crews/JoinCrewForm";
import { createCrew } from "@/app/(app)/crews/actions";

export default async function JoinCrewPage({ searchParams }: Readonly<{ searchParams: Promise<{ code?: string; mode?: string; auto?: string }> }>) {
  const { code, mode } = await searchParams;
  const session = await requireSession();

  let initialError: string | undefined;
  if (code) {
    const result = await joinCrewByCode(session.user.id, code);
    if (result.groupId) redirect(`/crews/${result.groupId}`);
    initialError = result.error;
  }

  const [t, crews] = await Promise.all([getT(), getUserCrews(session.user.id)]);
  const firstCrew = crews.length === 0;
  const starting = mode === "new";

  return (
    <div className="min-h-screen bg-surface flex flex-col gap-4.5 px-5 pt-4.5 pb-7 w-full max-w-xl mx-auto">
      {firstCrew ? (
        <div className="h-6" />
      ) : (
        <Link
          href="/crews"
          aria-label={t.common.back}
          className="w-11 h-11 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
      )}
      <header className="flex flex-col gap-1.5">
        <span className="font-heading font-bold text-[13px] tracking-[0.16em] uppercase text-gold">{firstCrew ? t.join.step : t.join.kicker}</span>
        <h1 className="font-display font-extrabold text-[44px] leading-[0.98]! uppercase">{t.join.title}</h1>
        <span className="font-body text-[15px] text-muted">{t.join.sub}</span>
      </header>

      <nav aria-label={t.join.title} className="grid grid-cols-2 gap-1 p-1 rounded-[14px] bg-surface-panel border border-line">
        {[
          { href: "/crews/join", label: t.join.join, active: !starting },
          { href: "/crews/join?mode=new", label: t.join.startNew, active: starting },
        ].map((x) => (
          <Link
            key={x.href}
            href={x.href}
            aria-current={x.active ? "page" : undefined}
            className={cn(
              "h-11 rounded-[10px] flex items-center justify-center font-heading font-bold text-[17px] tracking-[0.08em] uppercase",
              x.active ? "bg-amber text-ink" : "text-muted",
            )}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {starting ? (
        <form action={createCrew} className="flex-1 flex flex-col gap-3.5">
          <label htmlFor="cname" className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">
            {t.join.name}
          </label>
          <input
            id="cname"
            type="text"
            name="name"
            required
            autoFocus
            maxLength={40}
            placeholder={t.join.namePh}
            className="h-[60px] rounded-[14px] border-2 border-gold bg-surface-deep px-4 font-body font-semibold text-lg text-cream placeholder:text-muted outline-none"
          />
          <p className="flex gap-3 p-3.5 rounded-[14px] bg-surface-raised border border-gold/35 font-body text-sm leading-[1.4]!">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2" className="shrink-0" aria-hidden="true">
              <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
            </svg>
            {t.join.free}
          </p>
          <button type="submit" className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.06em] uppercase">
            {t.join.create}
          </button>
        </form>
      ) : (
        <JoinCrewForm initialError={initialError} />
      )}
    </div>
  );
}
