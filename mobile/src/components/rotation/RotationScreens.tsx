/**
 * Rotation screens
 *
 * The Americano / Mexicano sections from the website's design, for the app:
 * header, round progress, tabs, Live (mats, sit-outs, queue, top 3),
 * Standings (podium + table), Rounds (results per round) and the end
 * screen (champion, awards, final table).
 *
 * Exports: RotationHeader, RoundProgress, RotationTabs, LiveTab, Podium,
 *          StandingsTable, RoundsTab, FinalView, RotationTab
 * Data: a RotationView from GET /api/v1/rotations/{id}; view logic from
 *       the website's lib/rotation-view.ts.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { RotationView } from "@/lib/db/rotations";
import type { RotationStanding } from "@shared/rotation";
import { formOf, matsNow, rotationAwards, rotationProgress, type RotationAward } from "@/lib/rotation-view";
import { format, type Dictionary } from "@/lib/i18n";
import { colors, fonts, radius } from "@/theme";

type R = Dictionary["rot"];
type Names = (id: string) => string;
export type RotationTab = "live" | "standings" | "rounds";
const initials = (name: string) => name.slice(0, 2).toUpperCase();

export function RotationHeader({ v, R, onBack, onTv, onManage }: { v: RotationView; R: R; onBack: () => void; onTv?: () => void; onManage?: () => void }) {
  const live = v.status !== "completed";
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.round} hitSlop={6}>
        <Text style={{ color: colors.cream, fontSize: 20 }}>‹</Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={s.title}>
          {v.name}
        </Text>
        <Text numberOfLines={1} style={s.small}>
          {format(R.meta, { mode: v.mode === "americano" ? R.americano : R.mexicano, n: v.players.length, m: v.mats })}
        </Text>
      </View>
      {onManage && (
        <Pressable onPress={onManage} style={s.round} accessibilityLabel={R.manage}>
          <Text style={{ color: colors.cream, fontSize: 15 }}>⚙︎</Text>
        </Pressable>
      )}
      {onTv && (
        <Pressable onPress={onTv} style={s.round} accessibilityLabel={R.tv}>
          <Text style={{ color: colors.cream, fontSize: 15 }}>📺</Text>
        </Pressable>
      )}
      {live ? (
        <View style={s.liveTag}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>{R.live}</Text>
        </View>
      ) : (
        <View style={[s.liveTag, { backgroundColor: colors.raised }]}>
          <Text style={[s.liveText, { color: colors.muted }]}>{R.done}</Text>
        </View>
      )}
    </View>
  );
}

export function RoundProgress({ v, R, big = false }: { v: RotationView; R: R; big?: boolean }) {
  const p = rotationProgress(v);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={[s.roundBig, big && { fontSize: 56 }]}>
          {format(R.roundOf, { n: p.current })}
          <Text style={{ color: "#5b6460" }}>{` / ${p.rounds}`}</Text>
        </Text>
        <Text style={[s.kicker, big && { fontSize: 18 }]}>{format(R.gamesOf, { p: p.played, t: p.total })}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Array.from({ length: p.rounds }, (_, i) => {
          const r = i + 1;
          const share = r < p.current ? 1 : r === p.current ? p.roundShare : 0;
          return (
            <View key={r} style={[s.seg, big && { height: 8 }]}>
              <View style={{ width: `${Math.round(share * 100)}%`, height: "100%", backgroundColor: colors.gold }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function RotationTabs({ tab, onChange, R }: { tab: RotationTab; onChange: (t: RotationTab) => void; R: R }) {
  const tabs: [RotationTab, string][] = [
    ["live", R.tabLive],
    ["standings", R.tabStandings],
    ["rounds", R.tabRounds],
  ];
  return (
    <View style={s.tabs}>
      {tabs.map(([id, label]) => (
        <Pressable key={id} onPress={() => onChange(id)} style={[s.tab, tab === id && { backgroundColor: colors.gold }]} accessibilityState={{ selected: tab === id }}>
          <Text style={[s.tabText, tab === id && { color: colors.ink }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DuoAvatars({ names }: { names: string[] }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {names.map((n, i) => (
        <View key={i} style={[s.avatar, i > 0 && { marginLeft: -12, backgroundColor: "#343b3e" }]}>
          <Text style={s.avatarText}>{initials(n)}</Text>
        </View>
      ))}
    </View>
  );
}

export function LiveTab({ v, R, name, userId, onSeeAll }: { v: RotationView; R: R; name: Names; userId: string; onSeeAll: () => void }) {
  const { now, queue } = matsNow(v);
  const p = rotationProgress(v);
  const rest = v.byes[p.current] ?? [];
  const waitingNext = v.mode === "mexicano" && now.length === 0 && v.plannedRounds < v.rounds;
  const nextRound = queue[0]?.round;
  return (
    <>
      {now.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={s.kicker}>{R.onMat}</Text>
          {now.map((g, i) => (
            <View key={g.id} style={s.matCard}>
              <View style={s.matHead}>
                <Text style={[s.kicker, { color: colors.gold, fontSize: 15 }]}>{format(R.mat, { n: i + 1 })}</Text>
                <Text style={[s.small, { color: colors.soft }]}>
                  {format(R.round, { n: g.round }) + (g.firstTimeA && g.firstTimeB ? ` · ${R.firstTogether}` : "")}
                </Text>
              </View>
              <View style={{ padding: 16, gap: 8 }}>
                {(
                  [
                    [g.a, g.aElo],
                    [g.b, g.bElo],
                  ] as const
                ).map(([ids, elo], k) => (
                  <View key={k} style={{ gap: 8 }}>
                    {k === 1 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={s.hr} />
                        <Text style={[s.kicker, { fontSize: 13 }]}>{R.vs}</Text>
                        <View style={s.hr} />
                      </View>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <DuoAvatars names={ids.map(name)} />
                      <Text numberOfLines={1} style={[s.duo, ids.includes(userId) && { color: colors.gold }]}>
                        {ids.map(name).join(" & ")}
                      </Text>
                      <Text style={[s.small, { fontFamily: fonts.headBold, fontSize: 13 }]}>{elo}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => router.push({ pathname: "/americano/[id]/game/[slotId]", params: { id: v.id, slotId: g.id } })}
                style={[s.primary, { marginHorizontal: 16, marginBottom: 16 }]}
              >
                <Text style={s.primaryText}>{`${R.logResult} ›`}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {waitingNext && <Text style={s.body}>{format(R.waitingRound, { n: v.plannedRounds + 1 })}</Text>}
      {rest.length > 0 && now.length > 0 && (
        <View style={s.rest}>
          <DuoAvatars names={rest.map(name)} />
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>{R.restNow}</Text>
            <Text numberOfLines={2} style={[s.body, { fontFamily: fonts.bodySemi }]}>
              {format(R.restBack, { name: rest.map(name).join(", ") })}
            </Text>
          </View>
        </View>
      )}
      {queue.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.kicker}>{nextRound ? format(R.next, { n: nextRound }) : R.nextShort}</Text>
          {queue.slice(0, 4).map((g) => (
            <View key={g.id} style={s.queue}>
              <Text numberOfLines={1} style={[s.body, { flex: 1, color: colors.soft, fontSize: 14 }]}>
                {g.a.map(name).join(" & ")}
              </Text>
              <Text style={[s.kicker, { color: "#5b6460" }]}>{R.vs}</Text>
              <Text numberOfLines={1} style={[s.body, { flex: 1, color: colors.soft, fontSize: 14, textAlign: "right" }]}>
                {g.b.map(name).join(" & ")}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={s.kicker}>{R.standingsTop}</Text>
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={[s.kicker, { color: colors.gold }]}>{R.seeAll}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {v.standings.slice(0, 3).map((st, i) => {
            const lead = i === 0 && st.games > 0;
            return (
              <View key={st.userId} style={[s.top3, lead && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                <Text style={[s.kicker, lead && { color: colors.ink }]}>{`#${i + 1}`}</Text>
                <Text numberOfLines={1} style={[s.duo, { fontSize: 22 }, lead && { color: colors.ink }]}>
                  {name(st.userId)}
                </Text>
                <Text style={[s.num, lead && { color: colors.ink }]}>{`${st.wins}–${st.losses}`}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

export function Podium({ top, name }: { top: RotationStanding[]; name: Names }) {
  if (top.length < 3 || top[0].games === 0) return null;
  const order = [top[1], top[0], top[2]];
  const ring = [colors.soft, colors.gold, "#ff8a3d"];
  const height = [76, 104, 56];
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
      {order.map((st, i) => {
        const first = i === 1;
        return (
          <View key={st.userId} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            {first && <Text style={{ fontSize: 22 }}>👑</Text>}
            <View style={[s.podiumAvatar, first && { width: 60, height: 60, backgroundColor: colors.gold }, { borderColor: ring[i] }]}>
              <Text style={[s.avatarText, { fontSize: first ? 20 : 17 }, first && { color: colors.ink }]}>{initials(name(st.userId))}</Text>
            </View>
            <Text numberOfLines={1} style={[s.duo, { fontSize: first ? 22 : 19, textAlign: "center" }]}>
              {name(st.userId)}
            </Text>
            <View style={[s.block, { height: height[i] }, first && { backgroundColor: colors.gold }]}>
              <Text style={[s.blockN, first ? { color: colors.ink, fontSize: 40 } : { color: colors.soft }]}>{first ? 1 : i === 0 ? 2 : 3}</Text>
              <Text style={[s.num, { fontSize: 14 }, first ? { color: colors.ink } : { color: colors.muted }]}>
                {`${st.wins}–${st.losses}${first && st.elo !== 0 ? ` · ${st.elo > 0 ? "+" : ""}${st.elo}` : ""}`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function StandingsTable({ v, R, name, userId }: { v: RotationView; R: R; name: Names; userId: string }) {
  const form = formOf(v);
  const stopped = new Set(v.players.filter((p) => !p.active).map((p) => p.id));
  return (
    <View style={s.table}>
      <View style={s.row}>
        <Text style={[s.th, { width: 24 }]}>#</Text>
        <Text style={[s.th, { flex: 1 }]}>{R.colPlayer}</Text>
        <Text style={[s.th, s.cWl]}>{R.colWL}</Text>
        <Text style={[s.th, s.cPct]}>{R.colPct}</Text>
        <Text style={[s.th, s.cMama]}>{R.colMama}</Text>
        <Text style={[s.th, s.cElo]}>{R.colElo}</Text>
      </View>
      {v.standings.map((st, i) => {
        const f = (form[st.userId] ?? []).slice(-5);
        return (
          <View key={st.userId} style={[s.row, s.rowLine, st.userId === userId && { backgroundColor: "rgba(255,182,39,0.08)" }]}>
            <Text style={[s.num, { width: 24 }, i === 0 && st.games > 0 ? { color: colors.gold } : { color: colors.muted }]}>{i + 1}</Text>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text numberOfLines={1} style={[s.body, { fontFamily: fonts.bodySemi }]}>
                {st.userId === userId ? format(R.you, { name: name(st.userId) }) : name(st.userId)}
                {stopped.has(st.userId) ? <Text style={{ fontSize: 12, color: colors.redPale }}>{`  ${R.stoppedTag}`}</Text> : null}
              </Text>
              <View style={{ flexDirection: "row", gap: 3 }}>
                {f.map((x, k) => (
                  <View key={k} style={{ width: 14, height: 5, borderRadius: 2, backgroundColor: x === "W" ? colors.gold : "#3a4245" }} />
                ))}
              </View>
            </View>
            <Text style={[s.num, s.cWl]}>{`${st.wins}–${st.losses}`}</Text>
            <Text style={[s.body, s.cPct, { color: colors.soft, fontSize: 14 }]}>{st.games ? String(st.winPct) : "—"}</Text>
            <Text style={[s.num, s.cMama, { color: st.mama > 0 ? colors.red : "#5b6460" }]}>{st.mama}</Text>
            <Text style={[s.num, s.cElo, { fontSize: 16, color: st.elo > 0 ? colors.mint : st.elo < 0 ? colors.redPale : colors.muted }]}>
              {`${st.elo > 0 ? "+" : ""}${st.elo}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function RoundsTab({ v, R, name, finishSlot }: { v: RotationView; R: R; name: Names; finishSlot?: ReactNode }) {
  const p = rotationProgress(v);
  const rounds = Array.from({ length: v.plannedRounds }, (_, i) => i + 1)
    .filter((r) => v.games.some((g) => g.round === r && (g.played || r === p.current)))
    .reverse();
  const left = v.status === "completed" ? 0 : v.rounds - p.current;
  const chip = (kind: "W" | "L" | "-") => [s.chip, kind === "W" ? { backgroundColor: colors.gold } : kind === "L" ? { backgroundColor: colors.chip } : { borderWidth: 1, borderColor: colors.lineStrong }];
  return (
    <>
      {rounds.map((r) => {
        const live = r === p.current && v.status !== "completed" && v.games.some((g) => g.round === r && !g.played);
        const list = v.games.filter((g) => g.round === r);
        const rest = v.byes[r] ?? [];
        return (
          <View key={r} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={[s.duo, { fontSize: 20, flex: 0 }]}>{format(R.round, { n: r })}</Text>
              <Text style={[s.badge, live ? { backgroundColor: "rgba(255,107,91,0.16)", color: colors.redPale } : null]}>{live ? R.busy : R.finished}</Text>
              <View style={s.hr} />
            </View>
            {list.map((g, i) => {
              const res = g.played ? g.aWon : null;
              const side = (ids: readonly string[], won: boolean | null, kruip: boolean | undefined) => {
                const mama = ids.reduce((n, id) => n + (g.mama?.[id] ?? 0), 0);
                const extra = [mama > 0 ? format(R.mamaN, { n: mama }) : null, won === false && kruip ? R.kruiped : null].filter(Boolean).join(" · ");
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={chip(won === null ? "-" : won ? "W" : "L")}>
                      <Text style={[s.chipText, won ? { color: colors.ink } : null]}>{won === null ? "" : won ? R.won : R.lost}</Text>
                    </View>
                    <Text numberOfLines={1} style={[s.body, { flexShrink: 1 }, won === false ? { color: colors.muted } : { fontFamily: fonts.bodyBold }]}>
                      {ids.map(name).join(" & ")}
                    </Text>
                    {extra ? <Text style={[s.small, { color: colors.redPale, fontFamily: fonts.bodySemi }]}>{extra}</Text> : null}
                  </View>
                );
              };
              return (
                <Pressable
                  key={g.id}
                  disabled={!g.gameId}
                  onPress={() => g.gameId && router.push({ pathname: "/game/[id]", params: { id: g.gameId } })}
                  style={[s.result, !g.played && { borderColor: "rgba(255,182,39,0.4)" }]}
                >
                  <Text style={[s.kicker, { width: 44 }]}>{format(R.mat, { n: i + 1 })}</Text>
                  <View style={{ flex: 1, gap: 6 }}>
                    {side(g.a, res, g.kruipA)}
                    {side(g.b, res === null ? null : !res, g.kruipB)}
                  </View>
                  {g.gameId && <Text style={{ color: "#5b6460", fontSize: 16 }}>›</Text>}
                </Pressable>
              );
            })}
            {rest.length > 0 && <Text style={s.small}>{format(R.rest, { names: rest.map(name).join(", ") })}</Text>}
          </View>
        );
      })}
      {left > 0 && (
        <View style={s.left}>
          <Text style={[s.body, { color: colors.muted, fontSize: 14 }]}>{format(R.plannedLeft, { r: left, g: left * Math.floor(v.players.length / 4) })}</Text>
        </View>
      )}
      {finishSlot}
    </>
  );
}

const AWARD_ICON: Record<RotationAward["kind"], string> = { mama: "🔴", kruip: "🐢", riser: "📈", mamaGame: "⚡" };

export function FinalView({ v, R, name, userId, actions }: { v: RotationView; R: R; name: Names; userId: string; actions: ReactNode }) {
  const champ = v.standings.find((x) => x.games > 0);
  const awards = rotationAwards(v);
  const label: Record<RotationAward["kind"], [string, string]> = {
    mama: [R.awMama, R.awMamaV],
    kruip: [R.awKruip, R.awKruipV],
    riser: [R.awRiser, R.awRiserV],
    mamaGame: [R.awMamaGame, R.awMamaGameV],
  };
  const medal = [colors.gold, colors.soft, "#ff8a3d"];
  return (
    <>
      {champ && (
        <View style={s.champ}>
          <Text style={[s.kicker, { color: colors.ink, letterSpacing: 2.6 }]}>{R.champion}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={s.champName}>
            {name(champ.userId)}
          </Text>
          <View style={{ flexDirection: "row", gap: 18, marginTop: 8 }}>
            {(
              [
                [`${champ.wins}–${champ.losses}`, R.cWL],
                [`${champ.winPct}%`, R.cWin],
                [`${champ.elo > 0 ? "+" : ""}${champ.elo}`, R.cElo],
                [String(champ.partners), R.cPartners],
              ] as const
            ).map(([val, k]) => (
              <View key={k}>
                <Text style={[s.blockN, { color: colors.ink, fontSize: 28 }]}>{val}</Text>
                <Text style={[s.kicker, { color: colors.ink, fontSize: 11 }]}>{k}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {v.standings.slice(1, 3).map((st, i) => (
          <View key={st.userId} style={[s.queue, { flex: 1 }]}>
            <Text style={[s.blockN, { fontSize: 26, color: i === 0 ? colors.soft : "#ff8a3d" }]}>{i + 2}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[s.duo, { fontSize: 20 }]}>
                {name(st.userId)}
              </Text>
              <Text style={s.small}>{`${st.wins}–${st.losses} · ${st.winPct}%`}</Text>
            </View>
          </View>
        ))}
      </View>
      {awards.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.kicker}>{R.awards}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {awards.map((a) => (
              <View key={a.kind} style={s.award}>
                <Text style={{ fontSize: 20 }}>{AWARD_ICON[a.kind]}</Text>
                <Text style={s.kicker}>{label[a.kind][0]}</Text>
                <Text numberOfLines={1} style={[s.duo, { fontSize: 22 }]}>
                  {name(a.userId)}
                </Text>
                <Text style={[s.small, { color: colors.soft, fontSize: 13 }]}>{format(label[a.kind][1], { n: a.value, r: a.round ?? 0 })}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={s.table}>
        <Text style={[s.kicker, { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }]}>{R.finalTable}</Text>
        {v.standings.map((st, i) => (
          <View key={st.userId} style={[s.row, s.rowLine, st.userId === userId && { backgroundColor: "rgba(255,182,39,0.08)" }]}>
            <Text style={[s.num, { width: 24, color: medal[i] ?? colors.muted }]}>{i + 1}</Text>
            <Text numberOfLines={1} style={[s.body, { flex: 1, fontFamily: fonts.bodySemi }]}>
              {st.userId === userId ? format(R.you, { name: name(st.userId) }) : name(st.userId)}
            </Text>
            <Text style={[s.num, s.cWl]}>{`${st.wins}–${st.losses}`}</Text>
            <Text style={[s.body, { width: 44, textAlign: "right", color: colors.soft, fontSize: 14 }]}>{st.games ? `${st.winPct}%` : "—"}</Text>
          </View>
        ))}
      </View>
      {actions}
    </>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, textTransform: "uppercase" },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.cream },
  kicker: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.6, color: colors.muted, textTransform: "uppercase" },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.red },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink },
  liveText: { fontFamily: fonts.headBold, fontSize: 13, letterSpacing: 1.5, color: colors.ink },
  roundBig: { fontFamily: fonts.display, fontSize: 44, lineHeight: 44, color: colors.cream },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.chip, overflow: "hidden" },
  tabs: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  tab: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 1.1, color: colors.muted },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.chip, borderWidth: 3, borderColor: colors.deep, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, fontSize: 13, color: colors.cream },
  matCard: { borderRadius: 20, backgroundColor: colors.deep, borderWidth: 1, borderColor: "rgba(255,182,39,0.4)", overflow: "hidden" },
  matHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(255,182,39,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(255,182,39,0.2)" },
  hr: { flex: 1, height: 1, backgroundColor: colors.line },
  duo: { flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.cream, textTransform: "uppercase" },
  primary: { height: 50, borderRadius: 14, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.headBold, fontSize: 18, letterSpacing: 1.1, color: colors.ink },
  rest: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(243,241,234,0.18)" },
  queue: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  top3: { flex: 1, gap: 4, padding: 12, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  num: { fontFamily: fonts.headBold, fontSize: 17, color: colors.cream },
  podiumAvatar: { width: 52, height: 52, borderRadius: 30, backgroundColor: colors.chip, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  block: { width: "100%", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  blockN: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
  table: { borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: "rgba(243,241,234,0.06)" },
  th: { fontFamily: fonts.headBold, fontSize: 11, letterSpacing: 1.3, color: colors.muted },
  cWl: { width: 46, textAlign: "right" },
  cPct: { width: 36, textAlign: "right" },
  cMama: { width: 40, textAlign: "right" },
  cElo: { width: 44, textAlign: "right" },
  badge: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.4, color: colors.muted, backgroundColor: colors.raised, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  chip: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.headBold, fontSize: 12, color: colors.muted },
  result: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  left: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(243,241,234,0.18)" },
  champ: { borderRadius: 22, backgroundColor: colors.gold, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, gap: 6, overflow: "hidden" },
  champName: { fontFamily: fonts.display, fontSize: 72, lineHeight: 70, color: colors.ink, textTransform: "uppercase" },
  award: { width: "48.5%", gap: 6, padding: 14, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
});
