/**
 * Sessions
 *
 * The crew's game nights, newest first, like the website's Sessions tab:
 * MVP, biggest climber, mama kings, iron liver, duo of the night and the
 * per-player line for the night. Built from crew insights (no extra call).
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { SessionInsight } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { Card, Kicker, Txt } from "@/components/ui";
import { colors, fonts } from "@/theme";

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function Award({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.award}>
      <Txt v="label" numberOfLines={1}>
        {label}
      </Txt>
      <Txt v="bodySemi" numberOfLines={1}>
        {value}
      </Txt>
      {sub ? (
        <Txt style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

export function Sessions({ sessions }: { sessions: SessionInsight[] }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState<string | null>(sessions[0]?.night ?? null);
  const fmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  if (sessions.length === 0) return <Txt style={{ color: colors.muted }}>{t.sessions.empty}</Txt>;

  return (
    <View style={{ gap: 10 }}>
      {sessions.slice(0, 20).map((s) => {
        const expanded = open === s.night;
        const climber = s.movers[0];
        return (
          <Card key={s.night} raised={expanded} style={{ gap: 10 }}>
            <Pressable onPress={() => setOpen(expanded ? null : s.night)} style={{ gap: 2 }}>
              <Txt style={styles.date}>{fmt.format(new Date(`${s.night}T12:00:00Z`))}</Txt>
              <Txt style={{ color: colors.muted, fontSize: 13 }}>{format(t.sessions.meta, { g: s.games, p: s.players })}</Txt>
            </Pressable>
            {expanded && (
              <>
                <View style={styles.awards}>
                  {s.mvp && (
                    <Award
                      label={t.sessions.mvp}
                      value={first(s.mvp.name)}
                      sub={format(t.sessions.mvpSub, { w: s.mvp.wins, d: `${s.mvp.eloDelta >= 0 ? "+" : ""}${s.mvp.eloDelta}` })}
                    />
                  )}
                  {climber && climber.delta > 0 && <Award label={t.sessions.climber} value={first(climber.name)} sub={`▲${climber.delta} Elo`} />}
                  {s.mamaKings && (
                    <Award
                      label={s.mamaKings.names.length > 1 ? t.sessions.mamaKings : t.sessions.mamaKing}
                      value={s.mamaKings.names.map(first).join(" & ")}
                      sub={format(s.mamaKings.names.length > 1 ? t.sessions.mamaSub : t.sessions.mamaSubOne, { n: s.mamaKings.count })}
                    />
                  )}
                  {s.ironLiver && (
                    <Award label={t.sessions.iron} value={first(s.ironLiver.name)} sub={format(t.sessions.ironSub, { g: s.ironLiver.games, n: s.games })} />
                  )}
                  {s.duoOfNight && (
                    <Award
                      label={t.sessions.duo}
                      value={s.duoOfNight.names}
                      sub={format(t.sessions.duoSub, { w: s.duoOfNight.wins, l: s.duoOfNight.losses })}
                    />
                  )}
                </View>
                <Kicker>{t.sessions.lines}</Kicker>
                {[...s.lines]
                  .sort((a, b) => b.wins - a.wins || a.games - b.games)
                  .map((l) => {
                    const move = s.movers.find((m) => m.userId === l.userId)?.delta ?? 0;
                    return (
                      <View key={l.userId} style={styles.line}>
                        <Txt v="bodySemi" style={{ flex: 1 }} numberOfLines={1}>
                          {first(l.name)}
                        </Txt>
                        <Txt style={styles.num}>{`${l.wins}/${l.games}`}</Txt>
                        <Txt style={[styles.num, { color: l.mama > 0 ? colors.red : colors.dim, width: 34 }]}>{`${l.mama}M`}</Txt>
                        <Txt style={[styles.num, { width: 48, color: move >= 0 ? colors.mint : colors.redPale }]}>{`${move >= 0 ? "+" : ""}${move}`}</Txt>
                      </View>
                    );
                  })}
              </>
            )}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  date: { fontFamily: fonts.headBold, fontSize: 18, color: colors.cream, textTransform: "capitalize" },
  awards: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  award: { width: "48%", gap: 1, padding: 10, borderRadius: 12, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  line: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  num: { fontFamily: fonts.headBold, fontSize: 15, color: colors.soft, textAlign: "right", width: 40 },
});
