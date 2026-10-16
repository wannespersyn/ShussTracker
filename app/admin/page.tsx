import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getAllFeedback } from "@/lib/db/feedback";
import { feedbackStatusEnum } from "@/lib/db/schema";
import { cn } from "@/lib/cn";
import { Kicker, Panel, Screen, SectionHead, StatGrid } from "@/components/v2";
import { setFeedbackStatusAction } from "./actions";

export const metadata = { title: "Admin · Shussapp" };

type CrewRow = {
  id: string;
  name: string;
  plan: string;
  members: number;
  games: number;
  games30: number;
  last: Date | null;
};

/** Internal dashboard (English only): KPIs, crew activity and the feedback inbox. */
export default async function AdminPage({ searchParams }: Readonly<{ searchParams: Promise<{ status?: string }> }>) {
  await requireAdmin();
  const { status: statusFilter } = await searchParams;

  const [kpiRes, crewRes, items] = await Promise.all([
    db.execute(sql`
      select
        (select count(*) from "user")::int as users,
        (select count(*) from "group")::int as crews,
        (select count(*) from "game")::int as games,
        (select count(*) from "game" where played_at > now() - interval '7 days')::int as games7,
        (select count(distinct group_id) from "game" where played_at > now() - interval '30 days')::int as active30,
        (select count(distinct tp.user_id) from "game_team_player" tp join "game_team" t on t.id = tp.game_team_id
           join "game" g on g.id = t.game_id where g.played_at > now() - interval '30 days')::int as players30
    `),
    db.execute(sql`
      select g.id, g.name, g.plan::text as plan,
        (select count(*) from "group_member" m where m.group_id = g.id)::int as members,
        (select count(*) from "game" x where x.group_id = g.id)::int as games,
        (select count(*) from "game" x where x.group_id = g.id and x.played_at > now() - interval '30 days')::int as games30,
        (select max(played_at) from "game" x where x.group_id = g.id) as last
      from "group" g
      order by games30 desc, games desc
    `),
    getAllFeedback(),
  ]);
  const k = kpiRes.rows[0] as Record<string, number>;
  const crews = crewRes.rows as unknown as CrewRow[];
  const shown = statusFilter ? items.filter((f) => f.status === statusFilter) : items;
  const openCount = items.filter((f) => f.status === "new").length;
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Brussels" });

  return (
    <Screen>
      <header className="h-11 flex items-center justify-between">
        <h1 className="font-display font-extrabold text-[34px] uppercase">Admin</h1>
        <Link href="/home" className="font-heading font-bold text-sm uppercase text-gold">
          Back to app
        </Link>
      </header>

      <StatGrid
        items={[
          { label: "Users", value: k.users },
          { label: "Crews", value: k.crews },
          { label: "Games", value: k.games },
        ]}
      />
      <StatGrid
        items={[
          { label: "Games 7d", value: k.games7 },
          { label: "Crews 30d", value: k.active30 },
          { label: "Players 30d", value: k.players30 },
        ]}
      />

      <section className="flex flex-col gap-1.5" aria-label="Crews">
        <SectionHead title="Crews" />
        <div className="rounded-[18px] bg-surface-deep border border-line overflow-hidden">
          {crews.map((c, i) => (
            <div key={c.id} className={cn("flex items-center gap-3 px-3.5 py-2.5", i > 0 && "border-t border-line")}>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-body font-semibold text-[15px] truncate">
                  {c.name}
                  {c.plan !== "free" && <span className="ml-1.5 font-heading font-bold text-[11px] uppercase text-gold">{c.plan}</span>}
                </span>
                <span className="font-body text-xs text-cream/55">
                  {c.members} members · {c.games} games · last {c.last ? fmt.format(new Date(c.last)) : "—"}
                </span>
              </span>
              <span className="flex flex-col items-end">
                <span className="font-display font-bold text-xl tabular-nums">{c.games30}</span>
                <Kicker>30d</Kicker>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label="Feedback">
        <SectionHead title={`Feedback · ${openCount} new`} />
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter by status">
          {[undefined, ...feedbackStatusEnum.enumValues].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/admin?status=${s}` : "/admin"}
              className={cn(
                "h-8 px-3 rounded-pill flex items-center font-heading font-bold text-[13px] uppercase",
                statusFilter === s ? "bg-amber text-ink" : "bg-surface-panel border border-line text-cream/70",
              )}
            >
              {(s ?? "all").replace("_", " ")}
            </Link>
          ))}
        </nav>
        {shown.length === 0 && <p className="font-body text-sm text-cream/55">Nothing here.</p>}
        {shown.map((f) => (
          <Panel key={f.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-body text-xs text-cream/55">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-sm font-heading font-bold text-[11px] uppercase",
                  f.type === "bug" ? "bg-red/15 text-red" : f.type === "idea" ? "bg-amber/15 text-gold" : "bg-surface-raised text-cream/70",
                )}
              >
                {f.type}
              </span>
              <span className="truncate">
                {f.user?.name ?? "Deleted user"}
                {f.group ? ` · ${f.group.name}` : ""} · {fmt.format(f.createdAt)}
              </span>
              {f.type === "idea" && <span className="ml-auto font-heading font-bold text-gold">▲ {f.votes.length}</span>}
            </div>
            <p className="font-body text-sm leading-[1.4] whitespace-pre-wrap text-pretty">{f.text}</p>
            <form action={setFeedbackStatusAction.bind(null, f.id)} className="flex gap-2">
              <select
                name="status"
                defaultValue={f.status}
                aria-label="Status"
                className="flex-1 h-10 rounded-md bg-surface-panel border border-line px-2 font-body text-sm text-cream"
              >
                {feedbackStatusEnum.enumValues.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
              <button type="submit" className="h-10 px-4 rounded-md bg-amber text-ink font-heading font-bold text-sm uppercase">
                Save
              </button>
            </form>
          </Panel>
        ))}
      </section>
    </Screen>
  );
}
