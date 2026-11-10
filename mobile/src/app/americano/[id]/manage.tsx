/**
 * Manage an Americano — Route: /americano/[id]/manage (organizer)
 *
 * Change a running Americano / Mexicano like on the website: mats, rounds,
 * who keeps playing, who joins from the crew, and the standings order.
 * Shows what gets planned again and asks to confirm before saving.
 *
 * Data: GET /api/v1/rotations/{id}, PATCH /api/v1/rotations/{id}
 */
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api, ApiError } from "@/api/client";
import type { TiebreakKey } from "@shared/rotation";
import { rotationProgress } from "@/lib/rotation-view";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useRotation } from "@/lib/useRotation";
import { Button, CenterState, ErrorState, Toggle, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export default function ManageRotation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const R = t.rot;
  const { invalidate } = useCrew();
  const q = useRotation(id, false);
  const [edit, setEdit] = useState<{ mats: number; rounds: number; active: string[]; add: string[]; order: TiebreakKey[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const { rotation: v, roster, canManage } = q.data;
  if (!canManage || v.status === "completed") return <CenterState title="—" />;

  const st = edit ?? { mats: v.mats, rounds: v.rounds, active: v.players.filter((p) => p.active).map((p) => p.id), add: [], order: v.tiebreaks };
  const set = (patch: Partial<typeof st>) => setEdit({ ...st, ...patch });
  const currentRound = rotationProgress(v).current;
  const others = roster.filter((c) => !v.players.some((p) => p.id === c.id));
  const n = st.active.length + st.add.length;
  const lineupChanged = st.add.length > 0 || v.players.some((p) => p.active !== st.active.includes(p.id)) || st.rounds !== v.rounds;
  const impact = !lineupChanged
    ? R.impactNone
    : v.mode === "americano"
      ? format(R.impactA, { from: currentRound + 1, to: Math.max(st.rounds, currentRound + 1), n })
      : format(R.impactM, { n });
  const label: Record<TiebreakKey, string> = { pct: R.tbPct, wins: R.tbWins, mama: R.tbMama, elo: R.tbElo };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= st.order.length) return;
    const next = [...st.order];
    [next[i], next[j]] = [next[j], next[i]];
    set({ order: next });
  };

  async function doSave() {
    setSaving(true);
    setError(null);
    try {
      await api(`/rotations/${v.id}`, { method: "PATCH", body: { mats: st.mats, rounds: st.rounds, activeIds: st.active, addIds: st.add, tiebreaks: st.order } });
      invalidate();
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? t.app.offline : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function save() {
    if (n < 4) return;
    if (!lineupChanged) return void doSave();
    Alert.alert(R.manageTitle, impact, [
      { text: t.game.cancel, style: "cancel" },
      { text: R.save, onPress: () => void doSave() },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <Header title={R.manageTitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <Txt v="display" numberOfLines={1} style={{ fontSize: 26, textTransform: "uppercase" }}>
          {v.name}
        </Txt>
        {(
          [
            [R.manageMats, st.mats, 1, 8, (x: number) => set({ mats: x })],
            [R.manageRounds, st.rounds, currentRound, 30, (x: number) => set({ rounds: x })],
          ] as const
        ).map(([lbl, val, min, max, on]) => (
          <View key={lbl} style={styles.stepper}>
            <Text style={[styles.kicker, { flex: 1 }]}>{lbl}</Text>
            <Pressable onPress={() => on(Math.max(min, val - 1))} style={styles.stepBtn}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={[styles.big, { width: 40, textAlign: "center" }]}>{val}</Text>
            <Pressable onPress={() => on(Math.min(max, val + 1))} style={styles.stepBtn}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.kicker}>{R.managePlayers}</Text>
        <View style={styles.list}>
          {v.players.map((p) => {
            const on = st.active.includes(p.id);
            return (
              <Pressable key={p.id} onPress={() => set({ active: on ? st.active.filter((x) => x !== p.id) : [...st.active, p.id] })} style={styles.row}>
                <Txt v="bodySemi" style={{ flex: 1 }}>
                  {first(p.name)}
                </Txt>
                <Text style={[styles.small, { color: on ? colors.mint : colors.redPale }]}>{on ? R.playing : R.stopped}</Text>
                <Toggle on={on} />
              </Pressable>
            );
          })}
        </View>
        {n < 4 && <Text style={[styles.small, { color: colors.redPale }]}>{R.minActive}</Text>}

        {others.length > 0 && (
          <>
            <Text style={styles.kicker}>{R.addPlayers}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {others.map((c) => {
                const on = st.add.includes(c.id);
                return (
                  <Pressable key={c.id} onPress={() => set({ add: on ? st.add.filter((x) => x !== c.id) : [...st.add, c.id] })} style={[styles.chip, on && { borderColor: colors.gold, backgroundColor: colors.raised }]}>
                    <Text style={[styles.chipText, on && { color: colors.gold }]}>{(on ? "✓ " : "+ ") + first(c.name)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {st.add.length > 0 && <Text style={styles.small}>{`${R.joins}: ${st.add.map((x) => first(others.find((o) => o.id === x)?.name ?? "")).join(", ")}`}</Text>}
          </>
        )}

        <Text style={styles.kicker}>{R.tiebreaks}</Text>
        <View style={styles.list}>
          {st.order.map((k, i) => (
            <View key={k} style={styles.row}>
              <Text style={[styles.big, { fontSize: 18, width: 24, color: colors.muted }]}>{i + 1}</Text>
              <Txt v="bodySemi" style={{ flex: 1 }}>
                {label[k]}
              </Txt>
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel={format(R.up, { name: label[k] })} style={[styles.arrow, i === 0 && { opacity: 0.3 }]}>
                <Text style={styles.stepText}>↑</Text>
              </Pressable>
              <Pressable onPress={() => move(i, 1)} disabled={i === st.order.length - 1} accessibilityLabel={format(R.down, { name: label[k] })} style={[styles.arrow, i === st.order.length - 1 && { opacity: 0.3 }]}>
                <Text style={styles.stepText}>↓</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={styles.small}>{impact}</Text>
        {error && <Txt style={{ color: colors.redPale }}>{error}</Txt>}
        <Button label={saving ? R.saving : R.save} disabled={n < 4} loading={saving} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  kicker: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.6, color: colors.muted, textTransform: "uppercase" },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
  big: { fontFamily: fonts.display, fontSize: 28, color: colors.cream },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  stepBtn: { width: 44, height: 40, borderRadius: 10, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.cream },
  list: { borderRadius: radius.lg, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(243,241,234,0.05)" },
  arrow: { width: 38, height: 34, borderRadius: 8, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: "center" },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.soft },
});
