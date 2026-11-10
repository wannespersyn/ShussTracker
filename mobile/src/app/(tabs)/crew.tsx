/**
 * Crew tab — Route: /crew
 *
 * The selected crew, like the website's crew page: the leaderboard (players
 * ranked by Wilson win-rate, or duos — with move, streak, record and
 * most-played chips and last-5 form), the feed (games + crew records) and
 * nights, live beta cameras, the crew's tournaments and Americanos, guests
 * and crew links. The owner can share the invite. Pull to refresh.
 *
 * Data: GET /api/v1/crews/{crewId}, GET /api/v1/crews/{crewId}/feed
 */
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { api, apiUrl } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import type { CrewDetail, CrewRecord, FeedGame } from "@/api/types";
import { CenterState, Chip, ErrorState, FormDots, Kicker, MoveChip, Segmented, Txt } from "@/components/ui";
import { CrewEventRow, NewEventButtons } from "@/components/events/CrewEvents";
import { wilsonLowerBound } from "@/lib/ranking";
import { CrewSwitcher } from "@/components/CrewSwitcher";
import { NoCrew } from "@/components/crew/NoCrew";
import { Feed } from "@/components/crew/Feed";
import { Sessions } from "@/components/crew/Sessions";
import { LinkRow } from "@/components/Header";
import { colors, fonts } from "@/theme";

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function Crew() {
  const { t, locale } = useT();
  const { me, refreshMe } = useAuth();
  const { crew, version, invalidate } = useCrew();
  const [section, setSection] = useState<"board" | "feed" | "sessions">("board");
  const [view, setView] = useState<"players" | "duos">("players");
  const q = useQuery<CrewDetail>(crew ? `/crews/${crew.id}` : null, version);
  const feed = useQuery<{ games: FeedGame[]; records: CrewRecord[] }>(crew && section === "feed" ? `/crews/${crew.id}/feed?limit=40` : null, version);

  if (!crew) return <NoCrew />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  const { insights } = q.data;

  function leave(crewId: string, crewName: string) {
    Alert.alert(format(t.more.leaveConfirm, { crew: crewName }), undefined, [
      { text: t.game.cancel, style: "cancel" },
      {
        text: t.more.leaveCrew,
        style: "destructive",
        onPress: async () => {
          await api(`/crews/${crewId}/leave`, { method: "POST" }).catch(() => null);
          await refreshMe().catch(() => {});
          invalidate();
        },
      },
    ]);
  }

  function invite(crewName: string, code: string) {
    const url = apiUrl(`/crews/join?code=${code}`);
    void Share.share({ message: `${format(t.manage.shareTitle, { crew: crewName })} — ${t.join.code}: ${code}\n${url}` });
  }
  const userId = me?.user.id;
  const players = [...insights.players.filter((p) => p.games > 0), ...insights.players.filter((p) => p.games === 0)];
  const minDuoGames = insights.duos.filter((d) => d.games >= 2).length >= 5 ? 2 : 1;
  const duos = insights.duos
    .filter((d) => d.games >= minDuoGames)
    .sort((a, b) => wilsonLowerBound(b.wins, b.games) - wilsonLowerBound(a.wins, a.games) || b.games - a.games);
  const recordStreak = Math.max(0, ...insights.duos.map((d) => d.bestWinStreak));
  const mostPlayed = Math.max(0, ...insights.duos.map((d) => d.games));
  const playerRecord = Math.max(0, ...insights.players.filter((p) => p.games > 0).map((p) => p.bestWinStreak));
  const since = insights.firstGameAt
    ? new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" }).format(new Date(insights.firstGameAt))
    : null;
  const events = q.data.events;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={q.refreshing || feed.refreshing}
            onRefresh={() => (section === "feed" ? feed.reload() : q.reload())}
            tintColor={colors.gold}
          />
        }
      >
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt v="display" numberOfLines={1} style={{ textTransform: "uppercase", flex: 1 }}>
              {crew.name}
            </Txt>
            {q.data.crew.plan === "founding" && q.data.crew.isPro && <Chip tone="gold" label={`★ ${t.crew.founding}`} />}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Txt style={{ color: colors.muted, fontSize: 13, flex: 1 }}>
              {format(t.crew.meta, { p: insights.players.filter((p) => p.games > 0).length, g: insights.totalGames }) +
                (since ? ` · ${format(t.crew.since, { d: since })}` : "")}
            </Txt>
            {q.data.crew.inviteCode && (
              <Pressable onPress={() => invite(q.data!.crew.name, q.data!.crew.inviteCode!)} style={styles.invite}>
                <Text style={styles.inviteText}>{`+ ${t.app.invite}`}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <CrewSwitcher />
        {q.data.cameras.map((c) => (
          <Pressable key={c.id} onPress={() => void WebBrowser.openBrowserAsync(apiUrl(`/camera/view/${c.id}`))} style={styles.camera}>
            <View style={styles.cameraDot} />
            <Text style={styles.cameraText}>{format(c.calibrating ? t.camLive.crewCardCal : t.camLive.crewCard, { name: c.name })}</Text>
            <Txt style={{ color: colors.gold, fontSize: 18 }}>→</Txt>
          </Pressable>
        ))}
        <View style={styles.tabs}>
          {(["board", "feed", "sessions"] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setSection(id)}
              style={[styles.tab, section === id && styles.tabOn]}
              accessibilityState={{ selected: section === id }}
            >
              <Text style={[styles.tabText, section === id && { color: colors.cream }]}>
                {id === "board" ? t.crew.leaderboard : id === "feed" ? t.crew.feed : t.crew.sessions}
              </Text>
            </Pressable>
          ))}
        </View>

        {section === "feed" &&
          (feed.error && !feed.data ? (
            <ErrorState error={feed.error} onRetry={feed.reload} />
          ) : feed.data ? (
            <Feed games={feed.data.games} records={feed.data.records} />
          ) : (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
          ))}

        {section === "sessions" && <Sessions sessions={insights.sessions} />}

        {section === "board" && (
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: "players", label: t.crew.players },
                { id: "duos", label: t.crew.duos },
              ]}
            />

            <View style={styles.table}>
              <View style={[styles.row, styles.headRow]}>
                <Txt v="label" style={styles.cRank}>
                  #
                </Txt>
                <Txt v="label" style={styles.cName}>
                  {view === "duos" ? t.crew.colDuo : t.crew.colPlayer}
                </Txt>
                <Txt v="label" style={styles.cNum}>
                  {t.crew.colWl}
                </Txt>
                <Txt v="label" style={styles.cNum}>
                  {t.crew.colWin}
                </Txt>
                <Txt v="label" style={styles.cElo}>
                  {t.crew.colElo}
                </Txt>
              </View>

              {view === "players" &&
                players.map((p, i) => {
                  const played = p.games > 0;
                  return (
                    <Pressable
                      key={p.userId}
                      onPress={() => router.push({ pathname: "/player/[id]", params: { id: p.userId } })}
                      style={({ pressed }) => [styles.row, p.userId === userId && styles.mine, pressed && { opacity: 0.7 }]}
                    >
                      <Txt style={[styles.cRank, styles.rank, i === 0 && played && { color: colors.gold }]}>{played ? i + 1 : "–"}</Txt>
                      <View style={[styles.cName, { gap: 3 }]}>
                        <Txt v="bodySemi" numberOfLines={1}>
                          {first(p.name)}
                        </Txt>
                        <View style={styles.chips}>
                          {played && <MoveChip move={p.move} />}
                          {p.streak?.kind === "W" && p.streak.n >= 3 && <Chip tone="hot" label={format(t.crew.streak, { n: p.streak.n })} />}
                          {played && playerRecord >= 3 && p.bestWinStreak === playerRecord && <Chip tone="hot" label={format(t.crew.record, { n: playerRecord })} />}
                          {p.isGuest && <Chip tone="guest" label={t.common.guest} />}
                          <FormDots form={p.form.slice(-5)} size={6} />
                        </View>
                      </View>
                      <Txt style={[styles.cNum, styles.num]}>{played ? `${p.wins}–${p.losses}` : "—"}</Txt>
                      <Txt style={[styles.cNum, styles.num, { color: colors.soft }]}>{played ? `${p.winPct}%` : ""}</Txt>
                      <Txt style={[styles.cElo, styles.elo]}>{p.elo}</Txt>
                    </Pressable>
                  );
                })}

              {view === "duos" &&
                (duos.length === 0 ? (
                  <Txt style={{ color: colors.muted, padding: 14 }}>{t.crew.noDuos}</Txt>
                ) : (
                  duos.map((d, i) => {
                    const mine = d.a.id === userId || d.b.id === userId;
                    const partner = d.a.id === userId ? d.b : d.a;
                    return (
                      <Pressable
                        key={d.key}
                        onPress={() =>
                          mine
                            ? router.push({ pathname: "/(tabs)/duos", params: { with: partner.id } })
                            : router.push({ pathname: "/player/[id]", params: { id: d.a.id } })
                        }
                        style={({ pressed }) => [styles.row, mine && styles.mine, pressed && { opacity: 0.7 }]}
                      >
                        <Txt style={[styles.cRank, styles.rank, i === 0 && { color: colors.gold }]}>{i + 1}</Txt>
                        <View style={[styles.cName, { gap: 3 }]}>
                          <Txt v="bodySemi" numberOfLines={1}>{`${first(d.a.name)} & ${first(d.b.name)}`}</Txt>
                          <View style={styles.chips}>
                            {d.bestWinStreak === recordStreak && recordStreak >= 3 && <Chip tone="hot" label={format(t.crew.record, { n: recordStreak })} />}
                            {d.games === mostPlayed && <Chip tone="info" label={t.crew.mostPlayed} />}
                          </View>
                        </View>
                        <Txt style={[styles.cNum, styles.num]}>{`${d.wins}–${d.losses}`}</Txt>
                        <Txt style={[styles.cNum, styles.num, { color: colors.soft }]}>{`${d.winPct}%`}</Txt>
                        <Txt style={[styles.cElo, styles.elo]}>{d.duoElo}</Txt>
                      </Pressable>
                    );
                  })
                ))}
            </View>
            {view === "duos" && minDuoGames > 1 && <Txt style={{ color: colors.muted, fontSize: 12 }}>{format(t.crew.minGames, { n: minDuoGames })}</Txt>}
          </>
        )}
        <View style={{ gap: 8, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Kicker>{t.ev.title}</Kicker>
            {events.length > 0 && (
              <Pressable onPress={() => router.push({ pathname: "/crews/[id]/tournaments", params: { id: crew.id } })} hitSlop={8}>
                <Text style={styles.all}>{t.ev.all}</Text>
              </Pressable>
            )}
          </View>
          {[...events.filter((e) => e.live), ...events.filter((e) => !e.live).slice(0, 2)].map((e) => (
            <CrewEventRow key={`${e.kind}-${e.id}`} e={e} />
          ))}
          <NewEventButtons crewId={crew.id} />
        </View>
        <View style={{ gap: 8, marginTop: 12 }}>
          {insights.totalGames > 0 && (
            <LinkRow label={t.more.seasonRecap} onPress={() => router.push({ pathname: "/recap/[crewId]", params: { crewId: crew.id } })} />
          )}
          <LinkRow
            label={t.manage.guests}
            sub={`${q.data.guests.length}`}
            onPress={() => router.push({ pathname: "/crews/[id]/guests", params: { id: crew.id } })}
          />
          {q.data.crew.isOwner ? (
            <LinkRow label={t.crew.manage} onPress={() => router.push({ pathname: "/crews/[id]/manage", params: { id: crew.id } })} />
          ) : (
            <LinkRow label={t.more.leaveCrew} danger onPress={() => leave(crew.id, crew.name)} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  camera: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: "rgba(255,107,91,0.5)" },
  cameraDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
  cameraText: { flex: 1, fontFamily: fonts.headBold, fontSize: 14, letterSpacing: 0.8, color: colors.cream },
  all: { fontFamily: fonts.headBold, fontSize: 13, letterSpacing: 1.3, color: colors.gold },
  invite: { height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: colors.gold },
  inviteText: { fontFamily: fonts.headBold, fontSize: 13, letterSpacing: 0.8, color: colors.ink, textTransform: "uppercase" },
  tabs: { flexDirection: "row", gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabOn: { borderBottomColor: colors.gold },
  tabText: { fontFamily: fonts.headBold, fontSize: 16, letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  table: { borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headRow: { minHeight: 38 },
  mine: { backgroundColor: colors.raised, borderLeftWidth: 3, borderLeftColor: colors.gold },
  chips: { flexDirection: "row", alignItems: "center", gap: 5 },
  cRank: { width: 24 },
  cName: { flex: 1, minWidth: 0 },
  cNum: { width: 50, textAlign: "right" },
  cElo: { width: 50, textAlign: "right" },
  rank: { fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  num: { fontFamily: fonts.headSemi, fontSize: 17 },
  elo: { fontFamily: fonts.display, fontSize: 19 },
});
