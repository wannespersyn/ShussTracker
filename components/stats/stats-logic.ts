import type { StatsCrew, StatsEvent, StatsExplorerData, StatsFieldCounts, StatsGame, StatsPerson } from "@/lib/db/stats";
import { wilsonLowerBound } from "@/lib/ranking";

export type FieldKey = "far" | "mid" | "near" | "risk" | "miss";
export type PeriodKey = "all" | "season" | "month";
export type DimKey = "person" | "event" | "duo" | "crew" | "mat" | "period" | "field";

export type Filters = {
  person: string; // userId, or "ALL"
  event: string | null;
  duo: string | null; // "idA+idB", sorted
  crew: string | null;
  mat: "4" | "8" | null;
  period: PeriodKey;
  field: FieldKey | null;
};

export const DIMS: DimKey[] = ["person", "event", "duo", "crew", "mat", "period", "field"];

export const FIELDS: { key: FieldKey; label: string; word: string }[] = [
  { key: "far", label: "3S", word: "far-field 3s" },
  { key: "mid", label: "2S", word: "mid-field 2s" },
  { key: "near", label: "1S", word: "near-field 1s" },
  { key: "risk", label: "RED ZONE", word: "red-zone hits" },
  { key: "miss", label: "MISS", word: "misses" },
];

export function defaultFilters(currentUserId: string): Filters {
  return { person: currentUserId, event: null, duo: null, crew: null, mat: null, period: "all", field: null };
}

export function duoKey(a: string, b: string) {
  return [a, b].sort().join("+");
}

export function nameFor(people: StatsPerson[], id: string) {
  return people.find((p) => p.id === id)?.name ?? "Player";
}

export function firstName(name: string) {
  return name.split(" ")[0];
}

export function activeDims(f: Filters, currentUserId: string): DimKey[] {
  return DIMS.filter((d) => {
    if (d === "person") return f.person !== currentUserId;
    if (d === "period") return f.period !== "all";
    return Boolean(f[d]);
  });
}

function matchesPeriod(playedAtIso: string, period: PeriodKey): boolean {
  if (period === "all") return true;
  const played = new Date(playedAtIso);
  const now = new Date();
  if (period === "month") {
    return played.getFullYear() === now.getFullYear() && played.getMonth() === now.getMonth();
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 90);
  return played >= cutoff;
}

export function filterGames(games: StatsGame[], f: Filters): StatsGame[] {
  return games.filter((g) => {
    if (f.crew && g.crewId !== f.crew) return false;
    if (f.event && g.eventId !== f.event) return false;
    if (f.mat && g.matType !== f.mat) return false;
    if (!matchesPeriod(g.playedAt, f.period)) return false;
    if (f.duo) {
      const [a, b] = f.duo.split("+");
      if (!g.teams.some((t) => t.userIds.includes(a) && t.userIds.includes(b))) return false;
    } else if (f.person !== "ALL") {
      if (!g.teams.some((t) => t.userIds.includes(f.person))) return false;
    }
    return true;
  });
}

export function focalIdsFor(f: Filters): string[] | null {
  if (f.duo) return f.duo.split("+");
  if (f.person !== "ALL") return [f.person];
  return null;
}

function teamFor(g: StatsGame, focal: string[]) {
  return g.teams.find((t) => focal.every((id) => t.userIds.includes(id)));
}

export function winLoss(games: StatsGame[], focal: string[] | null): { w: number; l: number } {
  let w = 0;
  let l = 0;
  if (focal) {
    games.forEach((g) => {
      const t = teamFor(g, focal);
      if (!t) return;
      if (t.won) w++;
      else l++;
    });
  }
  return { w, l };
}

const emptyCounts = (): StatsFieldCounts => ({ far: 0, mid: 0, near: 0, risk: 0, miss: 0 });

export function sumShots(games: StatsGame[], focal: string[] | null): StatsFieldCounts {
  const c = emptyCounts();
  games.forEach((g) => {
    g.teams.forEach((t) => {
      t.userIds.forEach((uid) => {
        if (focal && !focal.includes(uid)) return;
        const s = t.shots[uid];
        if (!s) return;
        c.far += s.far;
        c.mid += s.mid;
        c.near += s.near;
        c.risk += s.risk;
        c.miss += s.miss;
      });
    });
  });
  return c;
}

export function totalOf(c: StatsFieldCounts) {
  return c.far + c.mid + c.near + c.risk + c.miss;
}

export function heroCopy(pct: number): string {
  if (pct >= 70) return "Statistically, you're a problem.";
  if (pct >= 55) return "Comfortably above the trash line.";
  if (pct >= 45) return "Respectable. Not scary.";
  return "The mat remembers everything.";
}

export function chipLabel(dim: DimKey, f: Filters, data: StatsExplorerData, currentUserId: string): string {
  switch (dim) {
    case "person":
      return f.person === "ALL"
        ? "Everyone"
        : nameFor(data.people, f.person) + (f.person === currentUserId ? " · you" : "");
    case "event":
      return f.event ? (data.events.find((e) => e.id === f.event)?.name ?? "Event") : "Event";
    case "duo":
      return f.duo ? f.duo.split("+").map((id) => firstName(nameFor(data.people, id))).join(" & ") : "Duo";
    case "crew":
      return f.crew ? (data.crews.find((c) => c.id === f.crew)?.name ?? "Crew") : "Crew";
    case "mat":
      return f.mat ? `${f.mat}-player mat` : "Mat type";
    case "period":
      return f.period === "all" ? "All-time" : f.period === "season" ? "Last 3 months" : "This month";
    case "field":
      return f.field ? FIELDS.find((x) => x.key === f.field)!.label : "Field type";
  }
}

export function summaryLine(f: Filters, data: StatsExplorerData, currentUserId: string): string {
  const bits: string[] = [];
  if (f.duo) bits.push(f.duo.split("+").map((id) => nameFor(data.people, id)).join(" & "));
  else if (f.person !== "ALL") bits.push(nameFor(data.people, f.person).toUpperCase() + (f.person === currentUserId ? " (you)" : ""));
  else bits.push("EVERYONE");
  if (f.event) bits.push(data.events.find((e) => e.id === f.event)?.name ?? "");
  if (f.crew && !f.event) bits.push(data.crews.find((c) => c.id === f.crew)?.name ?? "");
  bits.push(f.mat ? `${f.mat}-player mat` : "all mat types");
  bits.push(f.period === "all" ? "all-time" : f.period === "season" ? "last 3 months" : "this month");
  if (f.field) bits.push("only " + FIELDS.find((x) => x.key === f.field)!.word);
  return `Showing ${bits.join(" · ")}.`;
}

export type SheetOption = { val: string | null; label: string; meta: string; on: boolean };

export function sheetOptions(dim: DimKey, f: Filters, data: StatsExplorerData, currentUserId: string): SheetOption[] {
  switch (dim) {
    case "person":
      return [
        { val: "ALL", label: "Everyone", meta: "all players", on: f.person === "ALL" },
        ...data.people.map((p) => ({
          val: p.id,
          label: p.name + (p.id === currentUserId ? " (you)" : ""),
          meta: "",
          on: f.person === p.id,
        })),
      ];
    case "event":
      return [
        { val: null, label: "Every night", meta: "", on: !f.event },
        ...[...data.events]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((e) => ({
            val: e.id,
            label: e.name,
            meta: data.crews.find((c) => c.id === e.crewId)?.name ?? "",
            on: f.event === e.id,
          })),
      ];
    case "duo": {
      const me = f.person !== "ALL" ? f.person : currentUserId;
      const seen = new Set<string>();
      data.games.forEach((g) => g.teams.forEach((t) => { if (t.userIds.includes(me)) seen.add(duoKey(t.userIds[0], t.userIds[1])); }));
      return [
        { val: null, label: "Any pairing", meta: "", on: !f.duo },
        ...[...seen].map((key) => ({
          val: key,
          label: key.split("+").map((id) => nameFor(data.people, id)).join(" & "),
          meta: "",
          on: f.duo === key,
        })),
      ];
    }
    case "crew":
      return [
        { val: null, label: "All crews", meta: "", on: !f.crew },
        ...data.crews.map((c) => ({
          val: c.id,
          label: c.name,
          meta: `${c.memberCount} ${c.memberCount === 1 ? "member" : "members"}`,
          on: f.crew === c.id,
        })),
      ];
    case "mat":
      return [
        { val: null, label: "Any mat", meta: "", on: !f.mat },
        { val: "4", label: "4-player mat", meta: "two duos", on: f.mat === "4" },
        { val: "8", label: "8-player mat", meta: "four duos", on: f.mat === "8" },
      ];
    case "period":
      return [
        { val: "all", label: "All-time", meta: "", on: f.period === "all" },
        { val: "season", label: "Last 3 months", meta: "", on: f.period === "season" },
        { val: "month", label: "This month", meta: "", on: f.period === "month" },
      ];
    case "field":
      return [
        { val: null, label: "Everything", meta: "", on: !f.field },
        ...FIELDS.map((x) => ({
          val: x.key,
          label: x.key === "miss" ? "Misses" : x.key === "risk" ? "Red zone" : x.label,
          meta: x.word,
          on: f.field === x.key,
        })),
      ];
  }
}

export type RankedRow = {
  rank: number;
  userIds: string[];
  name: string;
  sub: string;
  val: string;
  valSub: string;
  hot: boolean;
};

export type RankedList = { title: string; sub: string; metric: string; rows: RankedRow[] };

export function computeRankedList(
  f: Filters,
  sel: StatsGame[],
  allGames: StatsGame[],
  people: StatsPerson[],
  crews: StatsCrew[],
  events: StatsEvent[],
  currentUserId: string,
): RankedList {
  if (f.event) {
    const agg = new Map<string, { w: number; l: number; pts: number }>();
    sel.forEach((g) =>
      g.teams.forEach((t) => {
        const key = duoKey(t.userIds[0], t.userIds[1]);
        const entry = agg.get(key) ?? { w: 0, l: 0, pts: 0 };
        if (t.won) entry.w++;
        else entry.l++;
        entry.pts += t.points;
        agg.set(key, entry);
      }),
    );
    const rows: RankedRow[] = [...agg.entries()]
      .sort((a, b) => b[1].pts - a[1].pts)
      .slice(0, 6)
      .map(([key, d], i) => {
        const ids = key.split("+");
        return {
          rank: i + 1,
          userIds: ids,
          name: ids.map((id) => firstName(nameFor(people, id))).join(" & ").toUpperCase(),
          sub: `${d.w}–${d.l} · ${d.pts} pts on the night`,
          val: String(d.pts),
          valSub: "POINTS",
          hot: f.duo === key,
        };
      });
    const eventName = events.find((e) => e.id === f.event)?.name ?? "that night";
    return {
      title: `STANDINGS — ${eventName.toUpperCase()}`,
      sub: "Every duo that showed up" + (f.mat ? ` on the ${f.mat}-player mat` : ""),
      metric: "POINTS",
      rows,
    };
  }

  if (f.crew) {
    const agg = new Map<string, { w: number; l: number; risk: number }>();
    sel.forEach((g) =>
      g.teams.forEach((t) =>
        t.userIds.forEach((uid) => {
          const entry = agg.get(uid) ?? { w: 0, l: 0, risk: 0 };
          if (t.won) entry.w++;
          else entry.l++;
          entry.risk += t.shots[uid]?.risk ?? 0;
          agg.set(uid, entry);
        }),
      ),
    );
    const rows: RankedRow[] = [...agg.entries()]
      .map(([uid, d]) => ({ uid, ...d, rate: d.w + d.l > 0 ? Math.round((d.w * 100) / (d.w + d.l)) : 0 }))
      .sort((a, b) => wilsonLowerBound(b.w, b.w + b.l) - wilsonLowerBound(a.w, a.w + a.l))
      .slice(0, 8)
      .map((d, i) => ({
        rank: i + 1,
        userIds: [d.uid],
        name: nameFor(people, d.uid).toUpperCase(),
        sub: `${d.w}–${d.l} · ${d.risk} red-zone hits`,
        val: `${d.rate}%`,
        valSub: "WIN RATE",
        hot: d.uid === f.person,
      }));
    const crewName = crews.find((c) => c.id === f.crew)?.name ?? "this crew";
    return {
      title: `WHO'S CARRYING ${crewName.toUpperCase()}`,
      sub: "Players inside this crew, best first",
      metric: "WIN RATE",
      rows,
    };
  }

  const me = f.person !== "ALL" ? f.person : currentUserId;
  const meGames = filterGames(allGames, { ...f, duo: null, person: me });
  const agg = new Map<string, { w: number; l: number }>();
  meGames.forEach((g) => {
    const t = g.teams.find((t) => t.userIds.includes(me));
    if (!t) return;
    const mate = t.userIds.find((id) => id !== me);
    if (!mate) return;
    const entry = agg.get(mate) ?? { w: 0, l: 0 };
    if (t.won) entry.w++;
    else entry.l++;
    agg.set(mate, entry);
  });
  const rows: RankedRow[] = [...agg.entries()]
    .map(([mate, d]) => ({ mate, ...d, rate: Math.round((d.w * 100) / (d.w + d.l)) }))
    .sort((a, b) => wilsonLowerBound(b.w, b.w + b.l) - wilsonLowerBound(a.w, a.w + a.l))
    .slice(0, 6)
    .map((d, i) => ({
      rank: i + 1,
      userIds: [me, d.mate],
      name: [me, d.mate].map((id) => firstName(nameFor(people, id))).join(" & ").toUpperCase(),
      sub: `${d.w}–${d.l} together`,
      val: `${d.rate}%`,
      valSub: "WIN RATE",
      hot: f.duo === duoKey(me, d.mate),
    }));
  const title =
    me === currentUserId ? "YOUR PARTNERS, RANKED" : `${firstName(nameFor(people, me)).toUpperCase()}'S PARTNERS, RANKED`;
  return { title, sub: "Pick a partner more carefully next time", metric: "WIN RATE", rows };
}
