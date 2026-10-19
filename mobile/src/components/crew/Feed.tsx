/**
 * Feed
 *
 * The crew's recent games, newest first, grouped per night: winners vs
 * losers, mama hits, reactions and comment count, with a photo thumbnail
 * when there is one. Tapping a game opens the game screen.
 *
 * Data: GET /api/v1/crews/{crewId}/feed?limit=40 (refetches on `version`).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { apiUrl, authHeaders } from "@/api/client";
import type { FeedGame } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { Kicker, Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

const GLYPH = { fire: "🔥", laugh: "😂", beer: "🍺", skull: "💀" } as const;
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
/** Games before 06:00 belong to the evening before, like on the website. */
const nightOf = (iso: string) => new Date(new Date(iso).getTime() - 6 * 3600 * 1000).toDateString();

export function Feed({ games }: { games: FeedGame[] }) {
  const { t, locale } = useT();
  const dayFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  const timeFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { hour: "2-digit", minute: "2-digit" });

  if (games.length === 0) return <Txt style={{ color: colors.muted, paddingVertical: 12 }}>{t.feed.empty}</Txt>;

  const nights: { key: string; label: string; games: FeedGame[] }[] = [];
  for (const g of games) {
    const key = nightOf(g.playedAt);
    const last = nights[nights.length - 1];
    if (last?.key === key) last.games.push(g);
    else nights.push({ key, label: dayFmt.format(new Date(new Date(g.playedAt).getTime() - 6 * 3600 * 1000)), games: [g] });
  }

  return (
    <View style={{ gap: 16 }}>
      {nights.map((n) => (
        <View key={n.key} style={{ gap: 8 }}>
          <Kicker>{format(t.feed.sessionTitle, { date: n.label, n: n.games.length })}</Kicker>
          {n.games.map((g) => {
            const [winner, ...rest] = g.teams;
            const reacted = g.reactions.filter((r) => r.count > 0);
            return (
              <Pressable
                key={g.id}
                onPress={() => router.push({ pathname: "/game/[id]", params: { id: g.id } })}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.win}>W</Text>
                    <Txt v="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
                      {winner?.playerNames.map(first).join(" & ")}
                    </Txt>
                  </View>
                  <Txt style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                    {`vs ${rest.map((x) => x.playerNames.map(first).join(" & ")).join(" · ")}`}
                  </Txt>
                  <View style={styles.meta}>
                    <Txt style={styles.metaText}>{`${timeFmt.format(new Date(g.playedAt))} · ${g.matType === "2" ? "1V1" : `${g.matType}-MAT`}`}</Txt>
                    {g.mama > 0 && <Txt style={[styles.metaText, { color: colors.red }]}>{format(t.feed.mamaN, { n: g.mama })}</Txt>}
                    {reacted.map((r) => (
                      <Txt key={r.reaction} style={styles.metaText}>{`${GLYPH[r.reaction]} ${r.count}`}</Txt>
                    ))}
                    {g.commentCount > 0 && <Txt style={styles.metaText}>{`💬 ${g.commentCount}`}</Txt>}
                  </View>
                </View>
                {g.photoPath && <Image source={{ uri: apiUrl(g.photoPath), headers: authHeaders() }} style={styles.thumb} contentFit="cover" />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  win: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: "hidden",
  },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  metaText: { fontSize: 12, color: colors.muted, fontFamily: fonts.bodySemi },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.raised },
});
