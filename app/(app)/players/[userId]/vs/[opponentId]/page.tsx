import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, requireSharesCrew } from "@/lib/db/authz";
import { getHeadToHead } from "@/lib/db/h2h";
import { getPlayerStatsSummary } from "@/lib/db/stats";
import { initialsFor } from "@/lib/format";
import { displayHero } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";
import { AvatarChip, BackButton, Card, StatCounter } from "@/components/ui";
import { rivalryInsight } from "@/lib/rivalry-insight";

type SideBySideRow = { name: string; a: string; b: string; aw: number; bw: number };

function sideBySideRows(
  aStats: Awaited<ReturnType<typeof getPlayerStatsSummary>>,
  bStats: Awaited<ReturnType<typeof getPlayerStatsSummary>>,
): SideBySideRow[] {
  const bar = (av: number, bv: number) => {
    const sum = av + bv;
    return sum > 0 ? { aw: Math.round((av * 100) / sum), bw: Math.round((bv * 100) / sum) } : { aw: 50, bw: 50 };
  };
  return [
    { name: "Win rate", a: `${aStats.winRate}%`, b: `${bStats.winRate}%`, ...bar(aStats.winRate, bStats.winRate) },
    { name: "Games", a: String(aStats.totalGames), b: String(bStats.totalGames), ...bar(aStats.totalGames, bStats.totalGames) },
    {
      name: "Hit rate",
      a: `${aStats.shotDist?.makeRate ?? 0}%`,
      b: `${bStats.shotDist?.makeRate ?? 0}%`,
      ...bar(aStats.shotDist?.makeRate ?? 0, bStats.shotDist?.makeRate ?? 0),
    },
    { name: "Mama hits", a: String(aStats.riskZone), b: String(bStats.riskZone), ...bar(aStats.riskZone, bStats.riskZone) },
  ];
}

export default async function HeadToHeadPage({
  params,
}: {
  params: Promise<{ userId: string; opponentId: string }>;
}) {
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

  const [h2h, aStats, bStats] = await Promise.all([
    getHeadToHead(aId, bId),
    getPlayerStatsSummary(aId),
    getPlayerStatsSummary(bId),
  ]);
  const aName = a.name ?? "Player";
  const bName = b.name ?? "Player";
  const total = h2h.aWins + h2h.bWins;
  const aPct = total > 0 ? Math.round((h2h.aWins * 100) / total) : 50;
  const sideBySide = sideBySideRows(aStats, bStats);
  const lastFive = h2h.meetings.slice(0, 5);
  const insight = rivalryInsight(h2h.meetings, aName.split(" ")[0], bName.split(" ")[0], h2h.aWins, h2h.bWins);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/players/${aId}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Head to head
          </div>
          <div className="font-display text-display-sm text-cream mt-1">
            {aName.split(" ")[0]} vs {bName.split(" ")[0]}
          </div>
        </div>
      </header>

      {total === 0 ? (
        <Card variant="flat" className="text-center py-8">
          <div className="font-display text-2xl text-cream mb-1">Never played each other</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
            No games with these two on opposite teams yet.
          </div>
        </Card>
      ) : (
        <>
          <Card variant="hero" className="flex items-center justify-center gap-6 py-6">
            <div className="flex flex-col items-center gap-2">
              <AvatarChip initials={initialsFor(aName)} ring="gold" size={56} />
              <StatCounter value={h2h.aWins} size={displayHero.h2hWinCount} className="text-gold" />
              <div className="font-body text-body-sm text-cream/60">{aName.split(" ")[0]}</div>
            </div>
            <div className="font-display text-2xl text-cream/30">–</div>
            <div className="flex flex-col items-center gap-2">
              <AvatarChip initials={initialsFor(bName)} ring="red" size={56} />
              <StatCounter value={h2h.bWins} size={displayHero.h2hWinCount} className="text-cream" />
              <div className="font-body text-body-sm text-cream/60">{bName.split(" ")[0]}</div>
            </div>
          </Card>

          <div className="h-2.5 rounded-pill bg-cream/8 overflow-hidden flex">
            <div className="h-full bg-gold" style={{ width: `${aPct}%` }} />
            <div className="h-full bg-red" style={{ width: `${100 - aPct}%` }} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Side by side
            </div>
            {sideBySide.map((row) => (
              <div key={row.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono font-semibold text-body-sm text-gold w-13">{row.a}</span>
                  <span className="font-mono font-medium text-[9.5px] tracking-[0.14em] uppercase text-cream/45">
                    {row.name}
                  </span>
                  <span className="font-mono font-semibold text-body-sm text-cream w-13 text-right">{row.b}</span>
                </div>
                <div className="flex items-center gap-1.25">
                  <div className="flex-1 h-2 rounded-pill bg-cream/6 overflow-hidden flex justify-end">
                    <div className="h-full rounded-pill bg-gold" style={{ width: `${row.aw}%` }} />
                  </div>
                  <div className="flex-1 h-2 rounded-pill bg-cream/6 overflow-hidden">
                    <div className="h-full rounded-pill bg-red" style={{ width: `${row.bw}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {lastFive.length > 0 && (
            <Card variant="flat">
              <div className="font-heading font-semibold text-[10.5px] tracking-kicker uppercase text-cream/50 mb-2.75">
                Last five
              </div>
              <div className="flex gap-1.75">
                {lastFive.map((m) => (
                  <div
                    key={m.gameId}
                    className={cn(
                      "flex-1 rounded-md py-2.5 text-center border",
                      m.aWon ? "bg-gold/12 border-gold/35" : "bg-red/12 border-red/35",
                    )}
                  >
                    <div className={cn("font-mono font-semibold text-body-sm", m.aWon ? "text-gold" : "text-red-bright")}>
                      {m.aWon ? "W" : "L"}
                    </div>
                    <div className="font-mono text-[8.5px] text-cream/35 mt-1.5">
                      {new Date(m.playedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {insight && (
            <div className="flex items-center gap-3 rounded-xl px-3.5 py-3.25 bg-linear-to-r from-gold/15 to-surface-deep border border-gold/30">
              <div className="font-display text-2xl text-gold shrink-0">{insight.big}</div>
              <div className="font-body text-body-sm text-cream/70 leading-snug text-pretty">{insight.text}</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Meetings
            </div>
            {h2h.meetings.map((m) => (
              <div
                key={m.gameId}
                className={cn(
                  "flex items-center gap-3 rounded-lg bg-surface-deep border-l-4 px-3.5 py-2.75",
                  m.aWon ? "border-gold" : "border-red",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center font-heading font-semibold text-sm",
                    m.aWon ? "bg-gold text-ink" : "bg-red text-cream",
                  )}
                >
                  {m.aWon ? aName[0] : bName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-semibold text-body-sm text-cream">{m.matType}-player mat</div>
                  <div className="font-mono text-[10.5px] text-cream/45 mt-1">
                    {new Date(m.playedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                <div className="font-mono font-semibold text-base text-cream/62">
                  {m.aScore}-{m.bScore}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
