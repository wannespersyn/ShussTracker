/**
 * New Americano / Mexicano — Route: /americano/new?crewId=&players=
 *
 * Like the website: name, format (Americano: fixed rotation, Mexicano: on
 * the standings), who plays (crew grid with Elo, all/none), mats and
 * rounds steppers, and an overview of rounds / games / duration. Start
 * plans the rounds and opens the tournament.
 *
 * Data: GET /api/v1/crews/{crewId} (roster), POST /api/v1/rotations
 */
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api, ApiError } from "@/api/client";
import type { CrewDetail } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { fullRotationRounds, gamesPerRound, type RotationMode } from "@shared/rotation";
import { Button, CenterState, ErrorState, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

const MINUTES_PER_GAME = 10;
const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;
function duration(min: number, locale: string) {
  if (min < 60) return `±${min} min`;
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return locale === "nl" ? `±${h}u${m}` : `±${h}h${m}`;
}

export default function NewRotation() {
  const { crewId, players } = useLocalSearchParams<{ crewId: string; players?: string }>();
  const { t, locale } = useT();
  const R = t.rot;
  const { invalidate } = useCrew();
  const q = useQuery<CrewDetail>(`/crews/${crewId}`);
  const [name, setName] = useState(R.defaultName);
  const [mode, setMode] = useState<RotationMode>("americano");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [mats, setMats] = useState(1);
  const [rounds, setRounds] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const roster = [...q.data.insights.players].sort((a, b) => b.games - a.games);
  const chosen = picked ?? (players ? players.split(",").filter((id) => roster.some((p) => p.userId === id)) : []);

  const n = chosen.length;
  const defaultRounds = mode === "americano" ? fullRotationRounds(n) : Math.min(Math.max(n - 1, 3), 8);
  const r = rounds ?? defaultRounds;
  const perRound = gamesPerRound(n);
  const totalGames = perRound * r;
  const minutes = Math.ceil(perRound / Math.max(1, mats)) * r * MINUTES_PER_GAME;
  const ready = n >= 4 && r >= 1;
  const full = mode === "americano" && r >= fullRotationRounds(n) && (n % 4 === 0 || n % 4 === 1);
  const byes = n % 4;
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);

  async function start() {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ id: string }>("/rotations", { method: "POST", body: { groupId: crewId, name, mode, playerIds: chosen, mats, rounds: r } });
      invalidate();
      router.replace({ pathname: "/americano/[id]", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? t.app.offline : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <Header title={R.newTitle} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>{R.kicker}</Text>
          <View style={{ gap: 6 }}>
            <Text style={styles.kicker}>{R.name}</Text>
            <TextInput value={name} onChangeText={setName} maxLength={60} placeholder={R.namePh} placeholderTextColor={colors.dim} style={styles.input} />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.kicker}>{R.mode}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(
                [
                  ["americano", R.americano, R.americanoSub, "⇄"],
                  ["mexicano", R.mexicano, R.mexicanoSub, "📶"],
                ] as const
              ).map(([id, label, sub, icon]) => {
                const on = mode === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      setMode(id);
                      setRounds(null);
                    }}
                    style={[styles.mode, on && { borderColor: colors.gold, backgroundColor: "rgba(255,182,39,0.1)" }]}
                  >
                    <Text style={{ fontSize: 20, color: on ? colors.gold : colors.muted }}>{icon}</Text>
                    <Text style={styles.modeTitle}>{label}</Text>
                    <Text style={styles.small}>{sub}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={styles.kicker}>
                {`${R.players} · `}
                <Text style={{ color: colors.gold }}>{format(R.picked, { n })}</Text>
              </Text>
              <Pressable onPress={() => setPicked(chosen.length === roster.length ? [] : roster.map((p) => p.userId))} hitSlop={8}>
                <Text style={[styles.kicker, { color: colors.gold }]}>{chosen.length === roster.length ? R.none : R.all}</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {roster.map((p) => {
                const on = chosen.includes(p.userId);
                return (
                  <Pressable key={p.userId} onPress={() => toggle(p.userId)} style={[styles.player, on && styles.playerOn]}>
                    <Txt v="bodySemi" numberOfLines={1} style={{ fontSize: 14 }}>
                      {first(p.name)}
                    </Txt>
                    <Txt style={styles.small}>{p.elo}</Txt>
                  </Pressable>
                );
              })}
            </View>
            {n < 4 && <Text style={styles.small}>{R.pickMin}</Text>}
          </View>

          <Stepper label={R.mats} value={mats} min={1} max={8} onChange={setMats} hint={mats === 1 ? R.matsSubOne : format(R.matsSub, { n: mats })} />
          <Stepper label={R.rounds} value={r} min={1} max={30} onChange={setRounds} hint={full ? R.fullRotation : undefined} />

          {n >= 4 && (
            <View style={styles.overview}>
              <View style={{ flexDirection: "row" }}>
                {(
                  [
                    [String(r), R.statRounds],
                    [String(totalGames), R.statGames],
                    [duration(minutes, locale), R.statTime],
                  ] as const
                ).map(([val, k]) => (
                  <View key={k} style={{ flex: 1 }}>
                    <Text style={styles.big}>{val}</Text>
                    <Text style={styles.kicker}>{k}</Text>
                  </View>
                ))}
              </View>
              {full && <Text style={[styles.small, { color: colors.mint }]}>{R.everyone}</Text>}
              {byes > 0 && <Text style={styles.small}>{format(R.byesFair, { n: byes })}</Text>}
            </View>
          )}
          {error && <Txt style={{ color: colors.redPale }}>{error}</Txt>}
          <Button
            label={saving ? R.building : format(R.start, { mode: mode === "americano" ? R.americano : R.mexicano }).toUpperCase()}
            disabled={!ready}
            loading={saving}
            onPress={start}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stepper({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <View style={styles.stepper}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{label}</Text>
        {hint ? <Text style={styles.small}>{hint}</Text> : null}
      </View>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={[styles.big, { width: 40, textAlign: "center" }]}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepBtn}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  kicker: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.6, color: colors.muted, textTransform: "uppercase" },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, lineHeight: 16 },
  input: { height: 52, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 16, fontFamily: fonts.headBold, fontSize: 22, color: colors.cream },
  mode: { flex: 1, gap: 8, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.deep },
  modeTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  player: { width: "31.5%", minHeight: 56, borderRadius: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.deep, borderWidth: 2, borderColor: "transparent" },
  playerOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  stepBtn: { width: 44, height: 40, borderRadius: 10, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.cream },
  big: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
  overview: { gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: colors.deep, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(243,241,234,0.18)" },
});
