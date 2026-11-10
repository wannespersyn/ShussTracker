/**
 * Deep stats — Route: /stats
 *
 * The website's deep stats on the phone: who (me / duo / crew), mat and
 * period chips; totals; mama rate or the full shot-zone split; and win % by
 * partner (or by player for the crew). Sliced on the device from one
 * payload, scoped to the crew you play in most.
 *
 * Data: GET /api/v1/stats
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { StatsData, StatsGame } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Card, CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts } from "@/theme";

type Who = "me" | "duo" | "crew";
type MatF = "all" | "4" | "8" | "2";
type Period = "30d" | "season" | "ever";
const DAY = 24 * 3600 * 1000;
const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {options.map(([id, label]) => (
        <Pressable key={id} onPress={() => onChange(id)} style={[styles.chip, value === id && styles.chipOn]}>
          <Text style={[styles.chipText, value === id && { color: colors.ink }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function DeepStatsScreen() {
  const { t } = useT();
  const d = t.deep;
  const { me } = useAuth();
  const userId = me?.user.id ?? "";
  const q = useQuery<StatsData>("/stats");
  const [who, setWho] = useState<Who>("me");
  const [mat, setMat] = useState<MatF>("all");
  const [period, setPeriod] = useState<Period>("season");
  const [shot, setShot] = useState<"mama" | "zones">("mama");
  const [now] = useState(() => Date.now());

  const s = useMemo(() => {
    const data = q.data;
    if (!data) return null;
    const count = new Map<string, number>();
    for (const g of data.games) if (g.crewId && g.teams.some((x) => x.userIds.includes(userId))) count.set(g.crewId, (count.get(g.crewId) ?? 0) + 1);
    const crew = [...data.crews].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0];
    const year = new Date(now).getFullYear();
    const games = data.games.filter(
      (g) =>
        g.crewId === crew?.id &&
        (mat === "all" || g.matType === mat) &&
        (period === "ever" || (period === "30d" ? now - new Date(g.playedAt).getTime() <= 30 * DAY : new Date(g.playedAt).getFullYear() === year)),
    );

    let crewMama = 0;
    let crewSlots = 0;
    for (const g of games)
      for (const tm of g.teams)
        for (const u of tm.userIds) {
          crewSlots++;
          crewMama += tm.shots[u]?.risk ?? 0;
        }
    const zones = { near: 0, mid: 0, far: 0, risk: 0, miss: 0 };
    let tracked = 0;
    const addZones = (c: typeof zones) => {
      if (!(c.near + c.mid + c.far + c.miss)) return;
      tracked++;
      zones.near += c.near;
      zones.mid += c.mid;
      zones.far += c.far;
      zones.risk += c.risk;
      zones.miss += c.miss;
    };
    const rank = (map: Map<string, { w: number; n: number }>) => {
      const all = [...map.entries()];
      const min = all.some(([, e]) => e.n >= 10) ? 10 : 3;
      return {
        min,
        list: all
          .filter(([, e]) => e.n >= min)
          .map(([id, e]) => ({ id, pct: Math.round((e.w / e.n) * 100) }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 8),
      };
    };

    if (who === "crew") {
      const per = new Map<string, { w: number; n: number }>();
      for (const g of games)
        for (const tm of g.teams)
          for (const u of tm.userIds) {
            const e = per.get(u) ?? { w: 0, n: 0 };
            e.n++;
            if (tm.won) e.w++;
            per.set(u, e);
            if (tm.shots[u]) addZones(tm.shots[u]);
          }
      const mamaGames = games.filter((g) => g.teams.some((tm) => tm.userIds.some((u) => (tm.shots[u]?.risk ?? 0) > 0))).length;
      return {
        crew,
        totals: [
          { k: d.games, v: String(games.length) },
          { k: d.players, v: String(per.size) },
          { k: d.mamaGame, v: games.length ? (crewMama / games.length).toFixed(2) : "—" },
        ],
        mamaPct: games.length ? Math.round((mamaGames / games.length) * 100) : 0,
        mamaLine: format(d.mamaLineCrew, { m: mamaGames, n: games.length }),
        you: crewSlots ? format(d.perPlayer, { v: (crewMama / crewSlots).toFixed(2) }) : "—",
        avg: "",
        best: Math.max(0, ...games.flatMap((g) => g.teams.flatMap((tm) => tm.userIds.map((u) => tm.shots[u]?.risk ?? 0)))),
        rows: rank(per),
        rowLabel: d.byPlayer,
        zones,
        tracked,
      };
    }

    const mine = games
      .map((g) => ({ g, team: g.teams.find((x) => x.userIds.includes(userId)) }))
      .filter((x): x is { g: StatsGame; team: StatsGame["teams"][number] } => !!x.team)
      .filter((x) => who !== "duo" || x.team.userIds.length === 2);
    let wins = 0;
    let myMama = 0;
    let mamaGames = 0;
    let best = 0;
    const per = new Map<string, { w: number; n: number }>();
    for (const { team } of mine) {
      if (team.won) wins++;
      const m = team.shots[userId]?.risk ?? 0;
      myMama += m;
      if (m > 0) mamaGames++;
      best = Math.max(best, m);
      if (team.shots[userId]) addZones(team.shots[userId]);
      for (const u of team.userIds) {
        if (u === userId) continue;
        const e = per.get(u) ?? { w: 0, n: 0 };
        e.n++;
        if (team.won) e.w++;
        per.set(u, e);
      }
    }
    const n = mine.length;
    return {
      crew,
      totals: [
        { k: d.games, v: String(n) },
        { k: d.winPct, v: n ? `${Math.round((wins / n) * 100)}%` : "—" },
        { k: d.mamaGame, v: n ? (myMama / n).toFixed(2) : "—" },
      ],
      mamaPct: n ? Math.round((mamaGames / n) * 100) : 0,
      mamaLine: format(d.mamaLine, { m: mamaGames, n }),
      you: n ? format(d.youPerGame, { v: (myMama / n).toFixed(2) }) : "—",
      avg: crewSlots && crew ? format(d.crewAvg, { crew: crew.name, v: (crewMama / crewSlots).toFixed(2) }) : "",
      best,
      rows: rank(per),
      rowLabel: d.byPartner,
      zones,
      tracked,
    };
  }, [q.data, who, mat, period, userId, now, d]);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data || !s) return <CenterState />;

  const nameOf = new Map(q.data.people.map((p) => [p.id, first(p.name)]));
  const zt = s.zones.near + s.zones.mid + s.zones.far + s.zones.risk + s.zones.miss;
  const zp = (n: number) => (zt ? Math.round((n / zt) * 100) : 0);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header
        title={t.profile.deepStats}
        right={
          s.crew ? (
            <Txt style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
              {s.crew.name}
            </Txt>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Chips
          value={who}
          onChange={setWho}
          options={[
            ["me", d.me],
            ["duo", d.duo],
            ["crew", d.crew],
          ]}
        />
        <Chips
          value={mat}
          onChange={setMat}
          options={[
            ["all", d.all],
            ["4", "4-MAT"],
            ["8", "8-MAT"],
            ["2", "1V1"],
          ]}
        />
        <Chips
          value={period}
          onChange={setPeriod}
          options={[
            ["30d", d.days30],
            ["season", d.season],
            ["ever", d.ever],
          ]}
        />

        <View style={styles.totals}>
          {s.totals.map((x) => (
            <View key={x.k} style={styles.total}>
              <Txt v="label" style={{ fontSize: 10 }}>
                {x.k}
              </Txt>
              <Txt style={{ fontFamily: fonts.display, fontSize: 28 }}>{x.v}</Txt>
            </View>
          ))}
        </View>

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Kicker>{d.shots}</Kicker>
            <Chips
              value={shot}
              onChange={setShot}
              options={[
                ["mama", d.mama],
                ["zones", d.allZones],
              ]}
            />
          </View>
          {shot === "mama" ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Txt style={{ fontFamily: fonts.display, fontSize: 34, color: colors.red }}>{`${s.mamaPct}%`}</Txt>
                <Txt style={{ color: colors.soft, flex: 1, fontSize: 13 }}>{s.mamaLine}</Txt>
              </View>
              <View style={styles.track}>
                <View style={{ width: `${s.mamaPct}%`, height: "100%", backgroundColor: colors.red }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <Txt style={styles.small}>{s.you}</Txt>
                {s.avg ? <Txt style={[styles.small, { color: colors.muted }]}>{s.avg}</Txt> : null}
                <Txt style={styles.small}>{format(d.best, { n: s.best })}</Txt>
              </View>
            </>
          ) : s.tracked === 0 ? (
            <Txt style={{ color: colors.muted, fontSize: 13 }}>{d.noTracking}</Txt>
          ) : (
            <>
              <View style={[styles.track, { height: 26, gap: 2, backgroundColor: "transparent" }]}>
                <View style={{ flex: zp(s.zones.near) || 0.001, backgroundColor: colors.soft }} />
                <View style={{ flex: zp(s.zones.mid) || 0.001, backgroundColor: "#8e9690" }} />
                <View style={{ flex: zp(s.zones.far) || 0.001, backgroundColor: "#5b6460" }} />
                <View style={{ flex: zp(s.zones.risk) || 0.001, backgroundColor: colors.red }} />
                <View style={{ flex: zp(s.zones.miss) || 0.001, backgroundColor: colors.chip }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Txt style={styles.small}>{`1 · ${zp(s.zones.near)}%`}</Txt>
                <Txt style={styles.small}>{`2 · ${zp(s.zones.mid)}%`}</Txt>
                <Txt style={styles.small}>{`3 · ${zp(s.zones.far)}%`}</Txt>
                <Txt style={[styles.small, { color: colors.redPale }]}>{`${d.mama} · ${zp(s.zones.risk)}%`}</Txt>
                <Txt style={[styles.small, { color: colors.muted }]}>{`${d.miss} · ${zp(s.zones.miss)}%`}</Txt>
              </View>
              <Txt style={{ color: colors.muted, fontSize: 12 }}>{format(d.fromTracked, { n: s.tracked })}</Txt>
            </>
          )}
        </Card>

        <Kicker>{`${s.rowLabel} · ${format(d.minGames, { n: s.rows.min })}`}</Kicker>
        {s.rows.list.length === 0 && <Txt style={{ color: colors.muted, fontSize: 13 }}>{d.notEnough}</Txt>}
        {s.rows.list.map((r, i) => (
          <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Txt v="bodySemi" style={{ width: 80 }} numberOfLines={1}>
              {nameOf.get(r.id) ?? t.more.player}
            </Txt>
            <View style={[styles.track, { flex: 1, height: 12 }]}>
              <View
                style={{
                  width: `${r.pct}%`,
                  height: "100%",
                  borderRadius: 6,
                  backgroundColor: r.pct >= 60 || (i === 0 && r.pct >= 50) ? colors.gold : colors.dim,
                }}
              />
            </View>
            <Txt style={{ width: 44, textAlign: "right", fontFamily: fonts.headBold, fontSize: 17 }}>{`${r.pct}%`}</Txt>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  chip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 6,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: fonts.headBold, fontSize: 13, letterSpacing: 0.6, color: colors.muted },
  totals: { flexDirection: "row", gap: 1, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  total: { flex: 1, padding: 12, backgroundColor: colors.deep, gap: 2 },
  track: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: colors.chip },
  small: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.soft },
});
