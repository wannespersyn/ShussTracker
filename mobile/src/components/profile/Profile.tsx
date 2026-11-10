/**
 * Profile
 *
 * A player's profile, shared by the player screen and the Me tab: rank in
 * the crew you share, Elo history (bar sparkline), games / W–L / win % /
 * mama, head-to-heads, achievements by category with progress, and their
 * nemesis.
 *
 * Exports: Profile
 * Data: a PlayerProfile from GET /api/v1/players/{id} (fetched by the caller).
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Achievement, PlayerProfile } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { Avatar, Card, Kicker, Segmented, StatTile, Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

const ICON: Record<Achievement["icon"], string> = { flame: "🔥", bolt: "⚡", crown: "👑", star: "⭐", target: "🎯" };

function EloBars({ history }: { history: { date: string; elo: number }[] }) {
  const values = [1000, ...history.map((h) => h.elo)].slice(-40);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  return (
    <View style={styles.bars}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${12 + ((v - min) / span) * 88}%`,
            borderRadius: 2,
            backgroundColor: i === values.length - 1 ? colors.gold : colors.chip,
          }}
        />
      ))}
    </View>
  );
}

export function Profile({ data, viewerId }: { data: PlayerProfile; viewerId?: string }) {
  const { t, locale } = useT();
  const [cat, setCat] = useState<Achievement["cat"]>("streak");
  const { player, stats, crew } = data;
  const name = player.name ?? t.more.player;
  const history = stats?.eloHistory ?? [];
  const eloDelta = history.length ? history[history.length - 1].elo - 1000 : 0;
  const since = history[0]
    ? new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
        new Date(`${history[0].date}T12:00:00Z`),
      )
    : "";
  const got = data.achievements.filter((a) => a.got).length;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Avatar name={name} size={64} />
        <View style={{ flex: 1 }}>
          <Txt v="display" numberOfLines={1}>
            {name}
          </Txt>
          {crew && stats && stats.games > 0 && (
            <Txt style={{ color: colors.muted }}>{format(t.profile.rankLine, { crew: crew.name, r: stats.rank, n: crew.rankedPlayers, e: stats.elo })}</Txt>
          )}
        </View>
      </View>

      {stats && stats.games > 0 && (
        <>
          <View style={styles.stats}>
            <StatTile label={t.home.games} value={stats.games} />
            <StatTile label="W–L" value={`${stats.wins}–${stats.losses}`} />
            <StatTile label={t.home.winPct} value={`${stats.winPct}%`} tone="gold" />
            <StatTile label={t.common.mama} value={stats.mama} tone="red" />
          </View>
          {history.length > 1 && (
            <Card style={{ gap: 8 }}>
              <View style={styles.between}>
                <Kicker>{format(t.profile.eloSince, { d: since })}</Kicker>
                <Txt style={{ fontFamily: fonts.headBold, color: eloDelta >= 0 ? colors.mint : colors.red }}>
                  {`${eloDelta >= 0 ? "▲" : "▼"} ${Math.abs(eloDelta)}`}
                </Txt>
              </View>
              <EloBars history={history} />
            </Card>
          )}
        </>
      )}

      {!player.isSelf && viewerId && (
        <Pressable onPress={() => router.push({ pathname: "/vs/[a]/[b]", params: { a: viewerId, b: player.id } })} style={styles.h2h}>
          <Txt v="bodySemi">{`${t.profile.vs} · ${t.common.you} vs ${name.split(" ")[0]}`}</Txt>
          <Txt style={{ color: colors.muted, fontSize: 18 }}>›</Txt>
        </Pressable>
      )}

      {data.nemesis && (
        <Pressable onPress={() => router.push({ pathname: "/vs/[a]/[b]", params: { a: player.id, b: data.nemesis!.opponentId } })}>
          <Card style={[styles.between, { borderColor: "rgba(255,107,91,0.35)" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <Avatar name={data.nemesis.opponentName} size={42} />
              <View style={{ flex: 1 }}>
                <Kicker style={{ color: colors.red }}>{t.more.nemesis}</Kicker>
                <Txt v="bodySemi" numberOfLines={1}>
                  {data.nemesis.opponentName}
                </Txt>
                <Txt style={{ color: colors.muted, fontSize: 12 }}>{`${data.nemesis.wins}W–${data.nemesis.losses}L`}</Txt>
              </View>
            </View>
            <Txt style={{ fontFamily: fonts.display, fontSize: 24, color: colors.red }}>
              {`${Math.round((data.nemesis.losses / Math.max(1, data.nemesis.wins + data.nemesis.losses)) * 100)}%`}
            </Txt>
          </Card>
        </Pressable>
      )}

      {player.isSelf && data.opponents.length > 0 && (
        <View style={{ gap: 6 }}>
          <Kicker>{t.profile.vs}</Kicker>
          {data.opponents.slice(0, 5).map((o) => (
            <Pressable key={o.userId} onPress={() => router.push({ pathname: "/vs/[a]/[b]", params: { a: player.id, b: o.userId } })} style={styles.h2h}>
              <Txt v="bodySemi" style={{ flex: 1 }} numberOfLines={1}>
                {o.name}
              </Txt>
              <Txt style={{ color: colors.muted, fontSize: 12 }}>{`${o.timesPlayed}×`}</Txt>
              <Txt style={{ color: colors.muted, fontSize: 18 }}>›</Txt>
            </Pressable>
          ))}
        </View>
      )}

      {data.achievements.length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={styles.between}>
            <Kicker>{t.ach.title}</Kicker>
            <Txt style={{ fontFamily: fonts.display, fontSize: 18, color: colors.gold }}>{`${got} / ${data.achievements.length}`}</Txt>
          </View>
          <Segmented
            value={cat}
            onChange={setCat}
            options={[
              { id: "streak", label: t.ach.streaks },
              { id: "games", label: t.ach.games },
              { id: "shots", label: t.ach.mama },
              { id: "social", label: t.ach.social },
            ]}
          />
          <View style={styles.grid}>
            {data.achievements
              .filter((a) => a.cat === cat)
              .map((a) => (
                <View key={a.id} style={[styles.ach, a.got && styles.achGot]}>
                  <View style={[styles.achIcon, a.got && { backgroundColor: colors.gold }]}>
                    <Text style={{ fontSize: 20, opacity: a.got ? 1 : 0.45 }}>{ICON[a.icon]}</Text>
                  </View>
                  <Txt style={styles.achName}>{a.name}</Txt>
                  <Txt style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }}>{a.desc}</Txt>
                  <View style={styles.progress}>
                    <View
                      style={{ width: `${Math.round(Math.min(1, a.have / a.need) * 100)}%`, height: "100%", backgroundColor: a.got ? colors.gold : colors.dim }}
                    />
                  </View>
                  <Txt style={[styles.achState, a.got && { color: colors.gold }]}>{a.got ? t.ach.unlocked : `${Math.min(a.have, a.need)} / ${a.need}`}</Txt>
                </View>
              ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  h2h: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stats: { flexDirection: "row", gap: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 64 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ach: { width: "48%", gap: 6, padding: 12, borderRadius: radius.lg, backgroundColor: colors.deep, borderWidth: 1, borderColor: "rgba(243,241,234,0.06)" },
  achGot: { backgroundColor: colors.raised, borderColor: "rgba(255,182,39,0.4)" },
  achIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip },
  achName: { fontFamily: fonts.headBold, fontSize: 18, lineHeight: 19, color: colors.cream },
  progress: { height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: colors.chip },
  achState: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, color: colors.muted },
});
