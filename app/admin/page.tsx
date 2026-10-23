import Link from "next/link";
import { sql } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getAllFeedback } from "@/lib/db/feedback";
import { feedbackStatusEnum } from "@/lib/db/schema";
import { cn } from "@/lib/cn";
import { setFeedbackStatusAction } from "./actions";
import { getBetaAdminStats } from "@/lib/db/beta";
import { BetaAdmin } from "./BetaAdmin";

export const metadata = { title: "Admin · Shussapp" };

type CrewRow = { id: string; name: string; plan: string; members: number; games: number; recent: number; last: Date | null };
type Period = "7" | "30" | "all";
const DAY = 24 * 3600 * 1000;

/** Internal desktop dashboard (English only): KPIs, crew activity and the
 * feedback inbox. */
export default async function AdminPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string; p?: string; status?: string }> }>) {
  await requireAdmin();
  const { view, p, status: statusFilter } = await searchParams;
  const period: Period = p === "7" || p === "all" ? p : "30";
  const since = period === "all" ? sql`'-infinity'::timestamp` : sql`now() - (${Number(period)} * interval '1 day')`;

  const [kpiRes, crewRes, items] = await Promise.all([
    db.execute(sql`
      select
        (select count(*) from "group")::int as crews,
        (select count(*) from "group" g where not exists (select 1 from "game" x where x.group_id = g.id))::int as crews_idle,
        (select count(*) from "user")::int as players,
        (select count(*) from "user" where is_guest)::int as guests,
        (select count(*) from "user" u where not exists (select 1 from "game_team_player" tp where tp.user_id = u.id))::int as never,
        (select count(*) from "game")::int as games,
        (select count(*) from "game" where played_at > ${since})::int as games_period,
        (select min(played_at) from "game") as first_game,
        (select count(*) from "group" where plan = 'pro')::int as paying
    `),
    db.execute(sql`
      select g.id, g.name, g.plan::text as plan,
        (select count(*) from "group_member" m where m.group_id = g.id)::int as members,
        (select count(*) from "game" x where x.group_id = g.id)::int as games,
        (select count(*) from "game" x where x.group_id = g.id and x.played_at > ${since})::int as recent,
        (select max(played_at) from "game" x where x.group_id = g.id) as last
      from "group" g
      order by recent desc, games desc
    `),
    getAllFeedback(),
  ]);
  const k = kpiRes.rows[0] as Record<string, number | string | null>;
  const crews = crewRes.rows as unknown as CrewRow[];
  const top = crews[0];
  const maxRecent = Math.max(1, ...crews.map((c) => c.recent));
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Brussels" });
  const nowMs = nowMillis();
  const ago = (d: Date | null) => {
    if (!d) return { text: "never", stale: true };
    const days = Math.floor((nowMs - new Date(d).getTime()) / DAY);
    return { text: days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`, stale: days > 7 };
  };
  const periodLabel = period === "all" ? "ALL" : `${period}D`;
  const q = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const all = { view, p: period === "30" ? undefined : period, ...extra };
    for (const [key, v] of Object.entries(all)) if (v) sp.set(key, v);
    const s = sp.toString();
    return s ? `/admin?${s}` : "/admin";
  };
  const open = items.filter((f) => f.status !== "done" && f.status !== "declined");
  const showFeedback = view === "feedback";
  const showBeta = view === "beta";
  const betaStats = showBeta ? await getBetaAdminStats() : null;
  const shown = statusFilter ? items.filter((f) => f.status === statusFilter) : items;

  return (
    <div className="min-h-screen bg-surface text-cream font-body p-6 flex flex-wrap gap-6 items-start">
      <aside className="flex-[1_1_220px] max-w-[260px] flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 px-3 pt-2 pb-5">
          <svg width="26" height="26" viewBox="0 0 30 30" aria-hidden="true">
            <circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeDasharray="3 2.2" />
            <circle cx="15" cy="15" r="8" fill="var(--color-gold)" />
          </svg>
          <span className="font-heading font-extrabold text-xl tracking-[0.06em]">SHUSSAPP ADMIN</span>
        </div>
        <nav aria-label="Admin" className="flex flex-col gap-1">
          <SideLink href={q({ view: undefined, status: undefined })} active={!showFeedback && !showBeta}>
            Overview
          </SideLink>
          <SideLink href={q({ view: "feedback" })} active={showFeedback}>
            Feedback & roadmap {open.length > 0 && <span className="ml-auto font-heading font-bold text-gold">{open.length}</span>}
          </SideLink>
          <SideLink href={q({ view: "beta", status: undefined })} active={showBeta}>
            Beta
          </SideLink>
          <SideLink href="/home">Back to the app</SideLink>
        </nav>
      </aside>

      <main className="flex-[999_1_640px] min-w-0 flex flex-col gap-5">
        <div className="flex flex-wrap justify-between items-end gap-3">
          <h1 className="font-display font-extrabold text-5xl leading-none uppercase">{showBeta ? "Beta" : showFeedback ? "Feedback" : "Overview"}</h1>
          {!showFeedback && !showBeta && (
            <div role="group" aria-label="Period" className="flex gap-1 p-1 rounded-md bg-surface-deep border border-line">
              {(
                [
                  ["7", "7 days"],
                  ["30", "30 days"],
                  ["all", "All time"],
                ] as const
              ).map(([id, label]) => (
                <Link
                  key={id}
                  href={q({ p: id === "30" ? undefined : id })}
                  className={cn("h-9 px-3.5 rounded-[9px] flex items-center", period === id ? "bg-amber text-ink font-bold" : "text-muted font-semibold")}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {betaStats ? (
          <BetaAdmin stats={betaStats} fmt={fmt} />
        ) : showFeedback ? (
          <section className="flex flex-col gap-3">
            <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
              {[undefined, ...feedbackStatusEnum.enumValues].map((s) => (
                <Link
                  key={s ?? "all"}
                  href={q({ status: s })}
                  className={cn(
                    "h-8 px-3 rounded-pill flex items-center font-heading font-bold text-[13px] uppercase",
                    statusFilter === s ? "bg-amber text-ink" : "bg-surface-deep border border-line text-soft",
                  )}
                >
                  {(s ?? "all").replace("_", " ")}
                </Link>
              ))}
            </nav>
            <div className="rounded-[20px] bg-surface-deep border border-line overflow-hidden">
              {shown.length === 0 && <p className="px-5 py-4 text-sm text-muted">Nothing here.</p>}
              {shown.map((f) => (
                <div key={f.id} className="px-5 py-3.5 border-b border-cream/6 last:border-b-0 flex flex-wrap gap-3 items-start">
                  <TypeTag type={f.feature ? "beta" : f.type} />
                  <span className="flex-[1_1_320px] min-w-0 flex flex-col gap-0.5">
                    <span className="font-semibold text-[15px] whitespace-pre-wrap">{f.text}</span>
                    <span className="text-[13px] text-muted">
                      {f.user?.name ?? "Deleted user"}
                      {f.group ? ` · ${f.group.name}` : ""} · {fmt.format(f.createdAt)}
                    </span>
                  </span>
                  {f.type === "idea" && <span className="font-heading font-extrabold text-lg text-gold">▲{f.votes.length}</span>}
                  <form action={setFeedbackStatusAction.bind(null, f.id)} className="flex gap-2">
                    <select
                      name="status"
                      defaultValue={f.status}
                      aria-label="Status"
                      className="h-9 rounded-sm bg-surface-raised border border-line px-2 text-sm text-cream"
                    >
                      {feedbackStatusEnum.enumValues.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="h-9 px-3 rounded-sm bg-amber text-ink font-heading font-bold text-sm uppercase">
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <Kpi k="CREWS" v={k.crews} s={`${k.crews_idle} never played a game`} />
              <Kpi k="PLAYERS" v={k.players} s={`${k.guests} guests · ${k.never} never played`} />
              <Kpi
                k={`GAMES ${periodLabel}`}
                v={k.games_period}
                s={top && Number(k.games_period) > 0 ? `${Math.round((top.recent / Number(k.games_period)) * 100)}% from ${top.name}` : "—"}
              />
              <Kpi k="GAMES TOTAL" v={k.games} s={k.first_game ? `since ${fmt.format(new Date(k.first_game as string))}` : "—"} />
              <Kpi k="PAYING CREWS" v={k.paying} s="free during the beta" />
            </div>

            <div className="flex flex-wrap gap-4 items-start">
              <section className="flex-[3_1_480px] min-w-0 rounded-[20px] bg-surface-deep border border-line overflow-hidden">
                <div className="px-5 py-4.5 font-heading font-bold text-xl tracking-[0.04em] border-b border-line">CREWS</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-[15px]">
                    <thead>
                      <tr className="text-left text-muted text-xs tracking-[0.1em]">
                        <th className="px-5 py-3 font-semibold">CREW</th>
                        <th className="px-5 py-3 font-semibold">PLAYERS</th>
                        <th className="px-5 py-3 font-semibold">GAMES {periodLabel}</th>
                        <th className="px-5 py-3 font-semibold">LAST GAME</th>
                        <th className="px-5 py-3 font-semibold">PLAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crews.map((c) => {
                        const last = ago(c.last);
                        return (
                          <tr key={c.id} className="border-t border-cream/6">
                            <td className="px-5 py-3.5 font-semibold">{c.name}</td>
                            <td className="px-5 py-3.5">{c.members}</td>
                            <td className="px-5 py-3.5">
                              <span className="flex items-center gap-2.5">
                                <span className="w-20 h-2 rounded-[4px] bg-chip overflow-hidden">
                                  <span className="block h-full bg-amber" style={{ width: `${Math.max(c.recent ? 6 : 0, (c.recent / maxRecent) * 100)}%` }} />
                                </span>
                                <span className="font-heading font-bold text-[17px]">{c.recent}</span>
                              </span>
                            </td>
                            <td className={cn("px-5 py-3.5", last.stale ? "text-red-pale" : "text-soft")}>{last.text}</td>
                            <td className="px-5 py-3.5">
                              <span
                                className={cn(
                                  "font-heading font-bold text-xs tracking-[0.1em] px-2 py-1 rounded-[6px] uppercase",
                                  c.plan === "free" ? "bg-chip text-soft" : "border border-gold/60 text-gold",
                                )}
                              >
                                {c.plan}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="flex-[2_1_320px] min-w-0 rounded-[20px] bg-surface-deep border border-line flex flex-col">
                <div className="px-5 py-4.5 flex justify-between items-center border-b border-line">
                  <span className="font-heading font-bold text-xl tracking-[0.04em]">FEEDBACK INBOX</span>
                  <Link href={q({ view: "feedback" })} className="text-[13px] text-gold">
                    See all
                  </Link>
                </div>
                {open.length === 0 && <p className="px-5 py-4 text-sm text-muted">Inbox zero.</p>}
                {open.slice(0, 6).map((f) => (
                  <div key={f.id} className="px-5 py-3.5 border-b border-cream/6 last:border-b-0 flex gap-3 items-start">
                    <TypeTag type={f.feature ? "beta" : f.type} />
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="font-semibold text-[15px] line-clamp-2">{f.text}</span>
                      <span className="text-[13px] text-muted">
                        {f.user?.name ?? "Deleted user"}
                        {f.group ? ` · ${f.group.name}` : ""} · {f.status.replace("_", " ")}
                      </span>
                    </span>
                    {f.type === "idea" && <span className="font-heading font-extrabold text-lg text-gold">▲{f.votes.length}</span>}
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function nowMillis() {
  return Date.now();
}

function SideLink({ href, active = false, children }: Readonly<{ href: string; active?: boolean; children: ReactNode }>) {
  return (
    <Link
      href={href}
      className={cn(
        "h-11 px-3.5 rounded-md flex items-center text-[15px]",
        active ? "bg-surface-raised text-cream font-bold shadow-[inset_3px_0_0_var(--color-gold)]" : "text-soft font-semibold",
      )}
    >
      {children}
    </Link>
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

function TypeTag({ type }: Readonly<{ type: string }>) {
  return (
    <span
      className={cn(
        "shrink-0 w-14 text-center font-heading font-bold text-xs tracking-[0.1em] py-1 rounded-[6px] uppercase",
        type === "idea" ? "bg-amber text-ink" : type === "bug" ? "bg-red text-ink" : "bg-chip text-soft",
      )}
    >
      {type}
    </span>
  );
}
