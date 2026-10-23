/**
 * Admin › Beta: participation KPIs, per-feature scores (positive share,
 * average, switched off) and the latest beta responses. English only, like
 * the rest of /admin.
 */
import { BETA_FEATURES, BETA_GENERAL } from "@/lib/beta";
import type { getBetaAdminStats } from "@/lib/db/beta";
import { en } from "@/lib/i18n/dictionaries/en";
import { cn } from "@/lib/cn";

type Stats = Awaited<ReturnType<typeof getBetaAdminStats>>;

function label(feature: string | null) {
  if (!feature || feature === BETA_GENERAL) return "Beta (general)";
  return (en.beta.features as Record<string, { title: string } | undefined>)[feature]?.title ?? feature;
}

export function BetaAdmin({ stats, fmt }: Readonly<{ stats: Stats; fmt: Intl.DateTimeFormat }>) {
  const byFeature = new Map(stats.features.map((f) => [f.feature, f]));
  const totalResponses = stats.features.reduce((n, f) => n + f.responses, 0);
  const rated = stats.features.reduce((n, f) => n + f.rated, 0);
  const avg = rated ? stats.features.reduce((n, f) => n + (f.avgRating ?? 0) * f.rated, 0) / rated : null;
  const rows = [...BETA_FEATURES.map((f) => f.key as string), BETA_GENERAL];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi k="PARTICIPANTS" v={stats.participants} s={`of ${stats.users} players with an account`} />
        <Kpi k="RESPONSES" v={totalResponses} s={`${rated} with a score`} />
        <Kpi k="AVG SCORE" v={avg === null ? "—" : `${avg.toFixed(1)}/4`} s="1 = meh · 4 = top" />
        <Kpi k="LEFT THE BETA" v={stats.left} s="joined once, now out" />
      </div>

      <section className="rounded-[20px] bg-surface-deep border border-line overflow-hidden">
        <div className="px-5 py-4.5 font-heading font-bold text-xl tracking-[0.04em] border-b border-line">PER FEATURE</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-muted text-xs tracking-[0.1em]">
                <th className="px-5 py-3 font-semibold">FEATURE</th>
                <th className="px-5 py-3 font-semibold w-[34%]">POSITIVE</th>
                <th className="px-5 py-3 font-semibold">AVG</th>
                <th className="px-5 py-3 font-semibold">SWITCHED OFF</th>
                <th className="px-5 py-3 font-semibold text-right">RESPONSES</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((key) => {
                const f = byFeature.get(key);
                const pos = f && f.rated ? Math.round((f.positive / f.rated) * 100) : null;
                return (
                  <tr key={key} className="border-t border-cream/6">
                    <td className="px-5 py-3.5 font-semibold">{label(key)}</td>
                    <td className="px-5 py-3.5">
                      {pos === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="flex items-center gap-2.5">
                          <span className="flex-1 h-2 rounded-[4px] bg-chip overflow-hidden">
                            <span className={cn("block h-full", pos >= 70 ? "bg-mint" : "bg-amber")} style={{ width: `${pos}%` }} />
                          </span>
                          <span className="font-heading font-bold text-[17px] w-12">{pos}%</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{f?.avgRating ? f.avgRating.toFixed(1) : "—"}</td>
                    <td className="px-5 py-3.5">{key === BETA_GENERAL ? "—" : (stats.offBy.get(key) ?? 0)}</td>
                    <td className="px-5 py-3.5 text-right font-heading font-bold text-[17px]">{f?.responses ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[20px] bg-surface-deep border border-line overflow-hidden">
        <div className="px-5 py-4.5 font-heading font-bold text-xl tracking-[0.04em] border-b border-line">LATEST RESPONSES</div>
        {stats.recent.length === 0 && <p className="px-5 py-4 text-sm text-muted">No beta feedback yet.</p>}
        {stats.recent.map((r) => {
          const good = (r.rating ?? 0) >= 3;
          return (
            <div key={r.id} className="px-5 py-3.5 border-b border-cream/6 last:border-b-0 flex gap-3 items-start">
              <span
                className={cn(
                  "shrink-0 w-13 h-10 rounded-[10px] flex items-center justify-center font-heading font-extrabold text-lg",
                  r.rating === null ? "bg-chip text-soft" : good ? "bg-mint/15 text-mint" : "bg-red/15 text-red-pale",
                )}
              >
                {r.rating === null ? "—" : `${r.rating}/4`}
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[13px] text-muted">
                  <strong className="text-cream">{r.user?.name ?? "Deleted user"}</strong> · {label(r.feature)} · {fmt.format(r.createdAt)}
                </span>
                <span className="font-semibold text-[15px] whitespace-pre-wrap">{r.text}</span>
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Kpi({ k, v, s }: Readonly<{ k: string; v: number | string | null; s: string }>) {
  return (
    <div className="rounded-[16px] p-4.5 bg-surface-deep border border-line flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-[0.1em] text-muted">{k}</span>
      <span className="font-display font-extrabold text-[40px] leading-none">{v ?? "—"}</span>
      <span className="text-[13px] text-muted">{s}</span>
    </div>
  );
}
