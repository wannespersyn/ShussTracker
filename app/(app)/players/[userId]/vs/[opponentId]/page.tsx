import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, requireSharesCrew } from "@/lib/db/authz";
import { getHeadToHead } from "@/lib/db/h2h";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { Avatar, Kicker, Screen } from "@/components/v2";

export default async function HeadToHeadPage({ params }: Readonly<{ params: Promise<{ userId: string; opponentId: string }> }>) {
  const { userId: aId, opponentId: bId } = await params;
  const session = await requireSession();
  const viewerId = session.user.id;

  const [a, b] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, aId) }),
    db.query.users.findFirst({ where: eq(users.id, bId) }),
  ]);
  if (!a || !b) notFound();
  try {
    await requireSharesCrew(viewerId, aId);
    await requireSharesCrew(viewerId, bId);
  } catch {
    notFound();
  }

  const [h2h, aCrews, bCrews, t] = await Promise.all([getHeadToHead(aId, bId), getUserCrews(aId), getUserCrews(bId), getT()]);
  const shared = aCrews.find((c) => bCrews.some((x) => x.id === c.id));
  const insights = shared ? await getCrewInsights(shared.id) : null;
  const pa = insights?.players.find((p) => p.userId === aId);
  const pb = insights?.players.find((p) => p.userId === bId);
  const aName = firstName(a.name ?? "Player");
  const bName = firstName(b.name ?? "Player");
  const total = h2h.aWins + h2h.bWins;

  const rows = [
    { label: t.h2h.winPct, x: pa?.winPct ?? 0, y: pb?.winPct ?? 0, fa: `${pa?.winPct ?? 0}%`, fb: `${pb?.winPct ?? 0}%` },
    {
      label: t.h2h.mamaGame,
      x: pa && pa.games ? pa.mama / pa.games : 0,
      y: pb && pb.games ? pb.mama / pb.games : 0,
      fa: pa && pa.games ? (pa.mama / pa.games).toFixed(2) : "0.00",
      fb: pb && pb.games ? (pb.mama / pb.games).toFixed(2) : "0.00",
    },
    { label: t.h2h.elo, x: pa?.elo ?? 1000, y: pb?.elo ?? 1000, fa: String(pa?.elo ?? "—"), fb: String(pb?.elo ?? "—") },
    { label: t.h2h.games, x: pa?.games ?? 0, y: pb?.games ?? 0, fa: String(pa?.games ?? 0), fb: String(pb?.games ?? 0) },
  ];
  const dateFmt = new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Brussels" });

  return (
    <Screen nav={false} className="pb-6">
      <header className="flex items-center justify-between h-11">
        <Link
          href={`/players/${aId}`}
          aria-label={t.common.back}
          className="w-11 h-11 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="font-heading font-extrabold text-[22px] tracking-[0.08em] uppercase">{t.h2h.title}</h1>
        <span className="w-11" />
      </header>

      <section aria-label={t.h2h.title} className="rounded-[20px] bg-surface-deep border border-line px-4 py-4.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Side name={aName} full={a.name ?? ""} lead={h2h.aWins >= h2h.bWins} />
          <div className="flex flex-col items-center">
            <span className="font-display font-extrabold text-[64px] leading-none tabular-nums">
              <span className={h2h.aWins >= h2h.bWins ? "text-gold" : undefined}>{h2h.aWins}</span>
              <span className="text-[#5b6460]">:</span>
              <span className={h2h.bWins > h2h.aWins ? "text-gold" : undefined}>{h2h.bWins}</span>
            </span>
            <span className="font-body font-semibold text-[11px] tracking-[0.1em] uppercase text-muted">{format(t.h2h.meetings, { n: total })}</span>
          </div>
          <Side name={bName} full={b.name ?? ""} lead={h2h.bWins > h2h.aWins} />
        </div>
      </section>

      {insights && (
        <section aria-label="Comparison" className="rounded-[18px] bg-surface-deep border border-line px-4 py-3.5 flex flex-col gap-3.5">
          {rows.map((r) => {
            const sum = r.x + r.y;
            const pctA = sum > 0 ? Math.round((r.x / sum) * 100) : 50;
            const aWins = r.x >= r.y;
            return (
              <div key={r.label} className="flex flex-col gap-1.5">
                <div className="grid grid-cols-[60px_1fr_60px] items-center">
                  <span className={cn("font-display font-extrabold text-xl", aWins ? "text-gold" : "text-muted")}>{r.fa}</span>
                  <span className="text-center font-body font-semibold text-[11px] tracking-[0.1em] uppercase text-muted">{r.label}</span>
                  <span className={cn("text-right font-display font-extrabold text-xl", aWins ? "text-muted" : "text-cream")}>{r.fb}</span>
                </div>
                <div className="flex gap-1 h-1.5">
                  <div className={cn("rounded-[3px]", aWins ? "bg-amber" : "bg-[#3a4144]")} style={{ width: `${pctA}%` }} />
                  <div className={cn("rounded-[3px]", aWins ? "bg-[#3a4144]" : "bg-soft")} style={{ width: `${100 - pctA}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section aria-label={t.h2h.last} className="flex flex-col gap-1.5">
        <Kicker>{t.h2h.last}</Kicker>
        {h2h.meetings.length === 0 ? (
          <p className="font-body text-sm text-muted">{t.h2h.none}</p>
        ) : (
          <div className="grid grid-cols-5 gap-1.5">
            {h2h.meetings.slice(0, 5).map((m) => (
              <Link
                key={m.gameId}
                href={`/game/${m.gameId}`}
                className={cn("h-13 rounded-[10px] flex flex-col items-center justify-center", m.aWon ? "bg-amber text-ink" : "bg-chip text-muted")}
              >
                <span className="font-display font-extrabold text-lg leading-none">{m.aWon ? "W" : "L"}</span>
                <span className="font-body font-semibold text-[10px]">{dateFmt.format(m.playedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {shared && (
        <Link
          href={`/log?crewId=${shared.id}`}
          className="mt-auto h-14 rounded-lg border-2 border-gold text-gold flex items-center justify-center font-heading font-extrabold text-[19px] tracking-[0.06em] uppercase"
        >
          {t.h2h.rematch}
        </Link>
      )}
    </Screen>
  );
}

function Side({ name, full, lead }: Readonly<{ name: string; full: string; lead: boolean }>) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center min-w-0">
      <Avatar name={full} size={44} fontSize={13} className={cn("border-2", lead ? "border-gold" : "border-[#5b6460]")} />
      <span className="font-heading font-bold text-lg uppercase truncate max-w-full">{name}</span>
    </div>
  );
}
