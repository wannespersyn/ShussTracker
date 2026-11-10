/**
 * StatsBlocks
 *
 * One block of the player-built stats page, in its size (S = half width,
 * M = full width, L = full width with more): Elo chart (tap a point for
 * the game), win %, games, streak, kruipen, mamas, mama rate, best game,
 * mama streak, form per night, nights, partners, rivals, crew records,
 * crew mama board and crew ranking. Same blocks as the website.
 *
 * Exports: StatsBlockView, BlockCard, blockTitle, BlockCtx
 * Data: a StatsScope from the website's lib/stats-scope.ts.
 */
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { StatsEloPoint, StatsGame } from "@/lib/db/stats";
import { ELO_BASE } from "@/lib/elo";
import type { StatsBlock } from "@shared/stats-layout";
import type { StatsScope } from "@shared/stats-scope";
import { format, type Dictionary } from "@/lib/i18n";
import { colors, fonts } from "@/theme";

export type BlockCtx = {
  sb: Dictionary["sb"];
  name: (id: string) => string;
  playerId: string;
  isMe: boolean;
  crewName: string;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
};

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const toneOf = (n: number) => (n > 0 ? colors.mint : n < 0 ? colors.redPale : colors.muted);
const initials = (n: string) => n.slice(0, 2).toUpperCase();

export function blockTitle(sb: Dictionary["sb"], kind: StatsBlock["kind"]) {
  return sb.b[kind];
}

export function BlockCard({ size, children, dim }: { size: StatsBlock["size"]; children: ReactNode; dim?: boolean }) {
  return <View style={[s.card, size === "S" ? s.half : s.full, dim && { opacity: 0.45 }]}>{children}</View>;
}

function Rows({ rows, name, highlight }: { rows: { id: string; v: number }[]; name: (id: string) => string; highlight: string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <View style={{ gap: 4 }}>
      {rows.map((r, i) => (
        <View key={r.id} style={s.barRow}>
          <Text style={[s.rank, i === 0 && { color: colors.gold }]}>{i + 1}</Text>
          <Text numberOfLines={1} style={[s.rowName, r.id === highlight && { color: colors.gold, fontFamily: fonts.bodyBold }]}>
            {name(r.id)}
          </Text>
          <View style={s.track}>
            <View style={{ height: "100%", width: `${Math.round((r.v / max) * 100)}%`, borderRadius: 5, backgroundColor: i === 0 ? colors.red : "#6b746f" }} />
          </View>
          <Text style={[s.num, { width: 40, textAlign: "right" }]}>{r.v}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatsBlockView({ block, s: sc, ctx }: { block: StatsBlock; s: StatsScope; ctx: BlockCtx }) {
  const { sb, name } = ctx;
  const title = blockTitle(sb, block.kind);
  const size = block.size;
  const empty = sc.mine.length === 0;
  const head = <Text style={s.kicker}>{title}</Text>;
  const none = <Text style={s.small}>{sb.noGames}</Text>;
  const wl = `${sc.wins}${sb.won} · ${sc.losses}${sb.lost}`;

  switch (block.kind) {
    case "elo":
      return <EloBlock s={sc} ctx={ctx} size={size} title={title} />;
    case "winPct": {
      const r = size === "S" ? 29 : 36;
      const c = 2 * Math.PI * 15;
      return (
        <BlockCard size={size}>
          {head}
          {empty ? (
            none
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Svg width={r * 2} height={r * 2} viewBox="0 0 36 36">
                <Circle cx={18} cy={18} r={15} fill="none" stroke={colors.chip} strokeWidth={5} />
                <Circle cx={18} cy={18} r={15} fill="none" stroke={colors.gold} strokeWidth={5} strokeDasharray={`${(sc.winPct / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
              </Svg>
              <View>
                <Text style={[s.big, { fontSize: 34 }]}>{`${sc.winPct}%`}</Text>
                <Text style={s.small}>{wl}</Text>
              </View>
            </View>
          )}
        </BlockCard>
      );
    }
    case "games":
      return (
        <BlockCard size={size}>
          {head}
          <Text style={s.big}>{sc.mine.length}</Text>
          <Text style={s.small}>{wl}</Text>
        </BlockCard>
      );
    case "streak":
      return (
        <BlockCard size={size}>
          {head}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={[s.big, sc.streak.current >= 3 && { color: colors.gold }]}>{sc.streak.current}</Text>
            <Text style={s.small}>{sb.current}</Text>
          </View>
          <Text style={s.small}>{format(sb.longest, { n: sc.streak.best })}</Text>
        </BlockCard>
      );
    case "kruipen":
      return (
        <BlockCard size={size}>
          {head}
          <Text style={s.big}>{sc.kruipen}</Text>
          <Text style={s.small}>{sc.kruipen > 0 && sc.kruipRank > 0 ? format(sb.rankInCrew, { n: sc.kruipRank }) : sb.noKruip}</Text>
        </BlockCard>
      );
    case "mamas":
      return (
        <BlockCard size={size}>
          {head}
          <Text style={[s.big, { color: colors.red }]}>{sc.mamas}</Text>
          <Text style={s.small}>{format(sb.perGame, { v: sc.mamaPerGame.toFixed(2) })}</Text>
        </BlockCard>
      );
    case "mamaRate":
      return (
        <BlockCard size={size}>
          {head}
          {empty ? (
            none
          ) : (
            <>
              <View style={{ flexDirection: size === "S" ? "column" : "row", alignItems: size === "S" ? "flex-start" : "baseline", gap: 10 }}>
                <Text style={[s.big, { color: colors.red, fontSize: size === "S" ? 44 : 56 }]}>{`${sc.mamaRate}%`}</Text>
                <Text style={[s.small, { fontSize: 14, color: colors.soft }]}>{sb.ofGames}</Text>
              </View>
              {size !== "S" && (
                <>
                  <View style={s.track}>
                    <View style={{ height: "100%", width: `${sc.mamaRate}%`, backgroundColor: colors.red }} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[s.small, { color: colors.soft }]}>{format(sb.perGame, { v: sc.mamaPerGame.toFixed(2) })}</Text>
                    <Text style={s.small}>{format(sb.crewAvg, { crew: ctx.crewName, v: sc.crewMamaPerGame.toFixed(2) })}</Text>
                  </View>
                </>
              )}
            </>
          )}
        </BlockCard>
      );
    case "bestGame":
      return (
        <BlockCard size={size}>
          {head}
          <Text style={s.big}>{sc.bestGame?.n ?? 0}</Text>
          <Text style={s.small}>
            {sc.bestGame
              ? sc.bestGame.partners.length
                ? format(sb.mamaWithP, { d: ctx.date(sc.bestGame.at), p: sc.bestGame.partners.map(name).join(" & ") })
                : format(sb.mamaWith, { d: ctx.date(sc.bestGame.at) })
              : "—"}
          </Text>
        </BlockCard>
      );
    case "mamaStreak":
      return (
        <BlockCard size={size}>
          {head}
          <Text style={s.big}>{sc.mamaStreak}</Text>
          <Text style={s.small}>{sb.nightsRow}</Text>
        </BlockCard>
      );
    case "form": {
      const list = sc.nights.slice(0, size === "L" ? 8 : 5).reverse();
      const max = Math.max(1, ...list.map((n) => Math.abs(n.elo)));
      const H = size === "L" ? 100 : 62;
      return (
        <BlockCard size={size}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {head}
            <Text style={s.small}>Elo ±</Text>
          </View>
          {list.length === 0 ? (
            none
          ) : (
            <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end" }}>
              {list.map((n) => (
                <View key={n.key} style={{ flex: 1, alignItems: "center", gap: 3 }}>
                  <Text style={[s.num, { fontSize: 13, color: toneOf(n.elo) }]}>{signed(n.elo)}</Text>
                  <View style={{ width: "100%", height: Math.max(8, Math.round((Math.abs(n.elo) / max) * H)), borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: n.elo > 0 ? colors.gold : "#3a4245" }} />
                  <Text numberOfLines={1} style={[s.small, { color: colors.cream, fontFamily: fonts.bodySemi }]}>
                    {ctx.date(n.at) + (n.form === "hot" ? " 🔥" : n.form === "cold" ? " 🥶" : "")}
                  </Text>
                  <Text style={[s.small, { fontSize: 11 }]}>{`${n.w}–${n.n - n.w}`}</Text>
                </View>
              ))}
            </View>
          )}
        </BlockCard>
      );
    }
    case "nights":
      return (
        <BlockCard size={size}>
          {head}
          {sc.nights.length === 0 && none}
          {sc.nights.slice(0, size === "L" ? 10 : 4).map((n, i) => (
            <View key={n.key} style={[s.line, i > 0 && s.lineTop]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{ctx.date(n.at) + (n.form === "hot" ? "  🔥" : n.form === "cold" ? "  🥶" : "")}</Text>
                <Text style={s.small}>{format(sb.sessionLine, { n: n.n, w: n.w, l: n.n - n.w }) + (n.mama > 0 ? ` · ${n.mama} mama` : "")}</Text>
              </View>
              <Text style={[s.num, { color: toneOf(n.elo) }]}>{signed(n.elo)}</Text>
            </View>
          ))}
        </BlockCard>
      );
    case "bestPartner": {
      const p = sc.bestPartner;
      return (
        <BlockCard size={size}>
          {head}
          {!p ? (
            <Text style={s.small}>{sb.notEnough}</Text>
          ) : (
            <>
              <View style={{ flexDirection: "row" }}>
                <View style={[s.avatar, { backgroundColor: colors.gold }]}>
                  <Text style={[s.avatarText, { color: colors.ink }]}>{initials(name(ctx.playerId))}</Text>
                </View>
                <View style={[s.avatar, { marginLeft: -12, backgroundColor: "#343b3e" }]}>
                  <Text style={s.avatarText}>{initials(name(p.id))}</Text>
                </View>
              </View>
              <View>
                <Text numberOfLines={1} style={[s.big, { fontSize: 22 }]}>
                  {name(p.id)}
                </Text>
                <Text style={s.small}>{`${p.w}–${p.l} · ${p.pct}%`}</Text>
              </View>
            </>
          )}
        </BlockCard>
      );
    }
    case "partners":
      return (
        <BlockCard size={size}>
          <Text style={s.kicker}>{`${title} · ${format(sb.minGames, { n: sc.minPartner })}`}</Text>
          {sc.partners.length === 0 && <Text style={s.small}>{sb.notEnough}</Text>}
          {sc.partners.slice(0, size === "L" ? 8 : 4).map((r, i) => (
            <View key={r.id} style={s.barRow}>
              <Text numberOfLines={1} style={[s.rowName, { width: 80 }]}>
                {name(r.id)}
              </Text>
              <View style={[s.track, { height: 12 }]}>
                <View style={{ height: "100%", width: `${r.pct}%`, borderRadius: 6, backgroundColor: r.pct >= 60 || (i === 0 && r.pct >= 50) ? colors.gold : "#6b746f" }} />
              </View>
              <Text style={[s.num, { width: 44, textAlign: "right" }]}>{`${r.pct}%`}</Text>
            </View>
          ))}
        </BlockCard>
      );
    case "h2h": {
      const list = sc.rivals.slice(0, size === "S" ? 1 : size === "M" ? 3 : 6);
      return (
        <BlockCard size={size}>
          {head}
          {list.length === 0 && none}
          {size === "S" && list[0] ? (
            <View>
              <Text style={s.small}>{sb.vs}</Text>
              <Text numberOfLines={1} style={[s.big, { fontSize: 22 }]}>
                {name(list[0].id)}
              </Text>
              <Text style={[s.big, { fontSize: 34, marginTop: 4 }, list[0].w >= list[0].l && { color: colors.gold }]}>{`${list[0].w}–${list[0].l}`}</Text>
            </View>
          ) : (
            list.map((r, i) => (
              <View key={r.id} style={[s.line, i > 0 && s.lineTop]}>
                <View style={[s.avatar, { width: 36, height: 36 }]}>
                  <Text style={s.avatarText}>{initials(name(r.id))}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={s.rowName}>{`${sb.vs} ${name(r.id)}`}</Text>
                  <Text style={s.small}>{`${r.n} ${sb.games}`}</Text>
                </View>
                <Text style={[s.num, { fontSize: 20, color: r.w > r.l ? colors.gold : r.w < r.l ? colors.redPale : colors.cream }]}>{`${r.w}–${r.l}`}</Text>
              </View>
            ))
          )}
        </BlockCard>
      );
    }
    case "records": {
      const cats = [
        [sb.rec.kruipen, sc.records.kruipen],
        [sb.rec.mama, sc.records.mama],
        [sb.rec.streak, sc.records.streak],
        [sb.rec.games, sc.records.games],
      ] as const;
      return (
        <BlockCard size={size}>
          {head}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {cats.map(([k, rows]) => (
              <View key={k} style={[s.rec, size === "L" && { width: "100%" }]}>
                <Text style={[s.kicker, { fontSize: 11 }]}>{k}</Text>
                {rows.length === 0 && <Text style={s.small}>—</Text>}
                {rows.slice(0, size === "L" ? 3 : 1).map((x, i) => (
                  <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {size === "L" && <Text style={[s.rank, { width: 16, fontSize: 14 }, i === 0 && { color: colors.gold }]}>{i + 1}</Text>}
                    <Text numberOfLines={1} style={[s.rowName, { flex: 1 }, x.id === ctx.playerId && { color: colors.gold }]}>
                      {name(x.id)}
                    </Text>
                    <Text style={s.num}>{x.v}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </BlockCard>
      );
    }
    case "crewMama":
      return (
        <BlockCard size={size}>
          <Text style={s.kicker}>{`${title} · ${ctx.crewName}`}</Text>
          {sc.crewMamaBoard.length === 0 && none}
          <Rows rows={sc.crewMamaBoard.slice(0, size === "L" ? 8 : 4)} name={name} highlight={ctx.playerId} />
        </BlockCard>
      );
    case "crewRanking":
      return (
        <BlockCard size={size}>
          {head}
          {sc.ranking.slice(0, size === "L" ? 10 : 5).map((r, i) => (
            <View key={r.id} style={[s.barRow, { height: 32 }]}>
              <Text style={[s.rank, i === 0 && { color: colors.gold }]}>{i + 1}</Text>
              <Text numberOfLines={1} style={[s.rowName, { flex: 1 }, r.id === ctx.playerId && { color: colors.gold, fontFamily: fonts.bodyBold }]}>
                {name(r.id)}
              </Text>
              <Text style={[s.num, { width: 52, textAlign: "right" }]}>{r.elo}</Text>
              <Text style={[s.num, { width: 44, textAlign: "right", fontSize: 14, color: toneOf(r.change) }]}>{signed(r.change)}</Text>
            </View>
          ))}
        </BlockCard>
      );
  }
}

function EloBlock({ s: sc, ctx, size, title }: { s: StatsScope; ctx: BlockCtx; size: StatsBlock["size"]; title: string }) {
  const { sb } = ctx;
  const [picked, setPicked] = useState<string | null>(null);
  const pickedGame = picked ? sc.games.find((g) => g.id === picked) : undefined;
  const pickedPoint = picked ? sc.curve.pts.find((p) => p.g === picked) : undefined;
  return (
    <BlockCard size={size}>
      <Text style={s.kicker}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Text style={[s.big, { fontSize: 44 }]}>{sc.curve.now}</Text>
        {sc.curve.pts.length > 0 && (
          <Text style={[s.num, { color: toneOf(sc.curve.change) }]}>{`${sc.curve.change > 0 ? "▲" : sc.curve.change < 0 ? "▼" : "•"} ${Math.abs(sc.curve.change)}`}</Text>
        )}
        <Text style={s.small}>{sb.inPeriod}</Text>
      </View>
      {sc.curve.pts.length < 2 ? (
        <Text style={[s.small, { textAlign: "center", paddingVertical: 24 }]}>{sb.tooFew}</Text>
      ) : (
        <EloChart points={sc.curve.pts} start={sc.curve.start} picked={picked} onPick={setPicked} label={ctx.date} short={size === "M"} />
      )}
      {pickedGame && pickedPoint && <GameDetail game={pickedGame} playerId={ctx.playerId} delta={pickedPoint.d} when={ctx.dateTime(pickedGame.playedAt)} ctx={ctx} />}
    </BlockCard>
  );
}

/** Elo line, one point per game, evenly spaced. Tap / drag to pick a game. */
function EloChart({ points, start, picked, onPick, label, short = false }: { points: StatsEloPoint[]; start: number; picked: string | null; onPick: (id: string) => void; label: (iso: string) => string; short?: boolean }) {
  const [w, setW] = useState(0);
  const W = 320;
  const H = short ? 110 : 150;
  const L = 34;
  const R = 8;
  const T = 8;
  const B = 22;
  const values = [start, ...points.map((p) => p.r)];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = Math.max(8, (hi - lo) * 0.12);
  lo = Math.floor((lo - pad) / 10) * 10;
  hi = Math.ceil((hi + pad) / 10) * 10;
  const n = points.length;
  const x = (i: number) => L + (i / n) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const pickedIdx = picked ? points.findIndex((p) => p.g === picked) : -1;

  function pickAt(e: GestureResponderEvent) {
    if (!w) return;
    const sx = (e.nativeEvent.locationX / w) * W;
    const i = Math.round(((sx - L) / (W - L - R)) * n) - 1;
    const p = points[Math.min(n - 1, Math.max(0, i))];
    if (p) onPick(p.g);
  }

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={pickAt}
      onResponderMove={pickAt}
      style={{ width: "100%", aspectRatio: W / H }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((v) => (
          <Line key={`l${v}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(243,241,234,0.08)" strokeWidth={1} />
        ))}
        {ticks.map((v) => (
          <SvgText key={`t${v}`} x={L - 6} y={y(v) + 3.5} textAnchor="end" fill={colors.muted} fontSize={10}>
            {String(v)}
          </SvgText>
        ))}
        {lo < ELO_BASE && hi > ELO_BASE && <Line x1={L} x2={W - R} y1={y(ELO_BASE)} y2={y(ELO_BASE)} stroke="rgba(243,241,234,0.2)" strokeDasharray="3 4" strokeWidth={1} />}
        <SvgText x={x(0)} y={H - 6} fill={colors.muted} fontSize={10}>
          {label(points[0].t)}
        </SvgText>
        <SvgText x={W - R} y={H - 6} textAnchor="end" fill={colors.muted} fontSize={10}>
          {label(points[n - 1].t)}
        </SvgText>
        <Path d={path} fill="none" stroke={colors.gold} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pickedIdx >= 0 && (
          <>
            <Line x1={x(pickedIdx + 1)} x2={x(pickedIdx + 1)} y1={T} y2={H - B} stroke="rgba(243,241,234,0.3)" strokeWidth={1} />
            <Circle cx={x(pickedIdx + 1)} cy={y(points[pickedIdx].r)} r={5} fill={colors.gold} stroke={colors.deep} strokeWidth={2} />
          </>
        )}
        <Circle cx={x(n)} cy={y(points[n - 1].r)} r={4} fill={colors.gold} stroke={colors.deep} strokeWidth={2} />
      </Svg>
    </View>
  );
}

function GameDetail({ game, playerId, delta, when, ctx }: { game: StatsGame; playerId: string; delta: number; when: string; ctx: BlockCtx }) {
  const { sb, name } = ctx;
  const mine = game.teams.find((x) => x.userIds.includes(playerId))!;
  const partners = mine.userIds.filter((u) => u !== playerId).map(name);
  const opponents = game.teams.filter((x) => x !== mine).map((x) => x.userIds.map(name).join(" & "));
  return (
    <Pressable onPress={() => router.push({ pathname: "/game/[id]", params: { id: game.id } })} style={s.detail} accessibilityLabel={sb.openGame}>
      <Text style={[s.result, mine.won ? { backgroundColor: colors.gold, color: colors.ink } : { backgroundColor: colors.chip, color: colors.soft }]}>{mine.won ? sb.won : sb.lost}</Text>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={s.rowName}>
          {(partners.length > 0 ? `${sb.with} ${partners.join(" & ")} · ` : "") + `${sb.vs} ${opponents.join(", ")}`}
        </Text>
        <Text style={s.small}>{when + (mine.kruip ? ` · ${sb.kruiped}` : "")}</Text>
      </View>
      <Text style={[s.num, { color: toneOf(delta) }]}>{signed(delta)}</Text>
      <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { gap: 8, padding: 14, borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  half: { width: "48.5%", minHeight: 140, justifyContent: "space-between" },
  full: { width: "100%" },
  kicker: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.6, color: colors.muted, textTransform: "uppercase" },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  big: { fontFamily: fonts.display, fontSize: 52, lineHeight: 52, color: colors.cream, textTransform: "uppercase" },
  num: { fontFamily: fonts.headBold, fontSize: 17, color: colors.cream },
  rank: { width: 20, fontFamily: fonts.headBold, fontSize: 16, color: colors.muted },
  rowName: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.cream },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 30 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.chip, overflow: "hidden" },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  lineTop: { borderTopWidth: 1, borderTopColor: "rgba(243,241,234,0.06)" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chip, borderWidth: 3, borderColor: colors.deep, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, fontSize: 14, color: colors.cream },
  rec: { width: "48%", gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.raised },
  detail: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line },
  result: { fontFamily: fonts.headBold, fontSize: 13, letterSpacing: 1.2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: "hidden" },
});
