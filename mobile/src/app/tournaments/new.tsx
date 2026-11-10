/**
 * New tournament — Route: /tournaments/new?crewId=…
 *
 * Same flow as the website: name it, pick an even number of players (4+),
 * shuffle into duos (tap two names to swap), choose a format with live
 * match counts — double elimination needs 4, 8, 16… duos — and start.
 *
 * Data: GET /api/v1/crews/{crewId}, POST /api/v1/tournaments
 */
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api, ApiError } from "@/api/client";
import type { CrewDetail, TournamentFormat } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { format, useT, type Dictionary } from "@/lib/i18n";
import { shortNamesFor, shuffleIntoDuos, type Team } from "@/lib/teams";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Button, CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

type Option = { value: TournamentFormat; label: string; tagline: string; preview: string; suggestion: string; disabled?: string };

function optionsFor(n: number, T: Dictionary["tour"]): Option[] {
  const single = Math.max(n - 1, 0);
  const double = Math.max(n * 2 - 2, 0);
  const robin = Math.round((n * (n - 1)) / 2);
  const pow2 = n >= 4 && (n & (n - 1)) === 0;
  return [
    {
      value: "single_elim",
      label: T.singleLabel,
      tagline: T.singleTag,
      preview: format(T.singlePreview, { n, g: single }),
      suggestion: n >= 6 ? T.singleBest : T.singleDefault,
    },
    {
      value: "double_elim",
      label: T.doubleLabel,
      tagline: T.doubleTag,
      preview: pow2 ? format(T.doublePreview, { n, g: double }) : T.doubleNeeds,
      suggestion: pow2 ? (n <= 8 ? T.doubleBest : T.doubleLong) : format(T.doubleFix, { n }),
      disabled: pow2 ? undefined : format(T.doubleReason, { n }),
    },
    {
      value: "round_robin",
      label: T.robinLabel,
      tagline: T.robinTag,
      preview: format(T.robinPreview, { n, g: robin }),
      suggestion: n <= 6 ? T.robinBest : format(T.robinLong, { n, g: robin }),
    },
  ];
}

export default function NewTournament() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const { t } = useT();
  const T = t.tour;
  const { version, invalidate } = useCrew();
  const q = useQuery<CrewDetail>(`/crews/${crewId}`, version);
  const [name, setName] = useState(T.defaultName);
  const [picked, setPicked] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [fmt, setFmt] = useState<TournamentFormat>("single_elim");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roster = useMemo(() => [...(q.data?.insights.players ?? [])].sort((a, b) => b.games - a.games).map((p) => ({ id: p.userId, name: p.name })), [q.data]);
  const short = useMemo(() => shortNamesFor(roster), [roster]);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  const canShuffle = picked.length >= 4 && picked.length % 2 === 0;
  const options = optionsFor(teams?.length ?? 0, T);
  const chosen = options.find((o) => o.value === fmt);

  function toggle(id: string) {
    setTeams(null);
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function tapToSwap(id: string) {
    if (!teams) return;
    if (!swapFrom || swapFrom === id) return setSwapFrom(swapFrom === id ? null : id);
    const flat = teams.flatMap((x) => x.players);
    const a = flat.find((p) => p.id === swapFrom)!;
    const b = flat.find((p) => p.id === id)!;
    setTeams(teams.map((x) => ({ ...x, players: x.players.map((p) => (p.id === a.id ? b : p.id === b.id ? a : p)) })));
    setSwapFrom(null);
  }

  async function start() {
    if (!teams || chosen?.disabled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ tournamentId: string }>("/tournaments", {
        method: "POST",
        body: { groupId: crewId, name: name.trim() || T.defaultName, format: fmt, entrantPairs: teams.map((x) => x.players.map((p) => p.id)) },
      });
      invalidate();
      router.replace({ pathname: "/tournaments/[id]", params: { id: res.tournamentId } });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? t.app.offline : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header title={T.newKicker} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Txt v="display" style={{ textTransform: "uppercase" }}>
            {T.setBracket}
          </Txt>
          <TextInput value={name} onChangeText={setName} placeholder={T.namePh} placeholderTextColor={colors.dim} maxLength={60} style={styles.input} />

          {!teams ? (
            <>
              <Txt style={{ color: colors.muted }}>{format(T.pickEven, { n: picked.length })}</Txt>
              <View style={styles.grid}>
                {roster.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <Pressable key={p.id} onPress={() => toggle(p.id)} style={[styles.chip, on && styles.chipOn]}>
                      <Txt style={{ fontFamily: fonts.headBold, color: on ? colors.ink : colors.soft }}>{short[p.id]}</Txt>
                    </Pressable>
                  );
                })}
              </View>
              <Button label={T.shuffle} disabled={!canShuffle} onPress={() => setTeams(shuffleIntoDuos(roster.filter((p) => picked.includes(p.id))))} />
            </>
          ) : (
            <>
              <View style={styles.between}>
                <Txt style={{ color: colors.muted, flex: 1 }}>{format(T.duosSwap, { n: teams.length })}</Txt>
                <Pressable onPress={() => setTeams(shuffleIntoDuos(teams.flatMap((x) => x.players)))} hitSlop={8}>
                  <Txt style={styles.link}>{t.chwazi.reshuffle}</Txt>
                </Pressable>
              </View>
              {teams.map((team, i) => (
                <View key={team.id} style={styles.team}>
                  <Kicker style={{ width: 64 }}>{format(t.chwazi.team, { n: i + 1 })}</Kicker>
                  {team.players.map((p) => (
                    <Pressable key={p.id} onPress={() => tapToSwap(p.id)} style={[styles.swap, swapFrom === p.id && { borderColor: colors.gold }]}>
                      <Avatar name={p.name} size={24} />
                      <Txt v="bodySemi" numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
                        {short[p.id]}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              ))}

              <Kicker>{T.pickFormat}</Kicker>
              {options.map((o) => {
                const on = fmt === o.value;
                return (
                  <Pressable
                    key={o.value}
                    disabled={!!o.disabled}
                    onPress={() => setFmt(o.value)}
                    style={[styles.format, on && !o.disabled && styles.formatOn, o.disabled && { opacity: 0.55 }]}
                  >
                    <View style={styles.between}>
                      <Txt style={styles.formatLabel}>{o.label}</Txt>
                      {on && !o.disabled && <Txt style={{ color: colors.gold, fontSize: 11, fontFamily: fonts.headBold }}>{T.selected.toUpperCase()}</Txt>}
                    </View>
                    <Txt style={{ color: colors.soft }}>{o.tagline}</Txt>
                    <Txt style={{ color: colors.muted, fontSize: 12 }}>{o.preview}</Txt>
                    <Txt style={{ color: o.disabled ? colors.redPale : colors.gold, fontSize: 13 }}>{o.disabled ?? o.suggestion}</Txt>
                  </Pressable>
                );
              })}
              {error && <Txt style={{ color: colors.redPale, textAlign: "center" }}>{error}</Txt>}
              <Button label={busy ? T.building : T.start} loading={busy} disabled={!!chosen?.disabled} onPress={start} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    color: colors.cream,
    fontFamily: fonts.bodySemi,
    fontSize: 16,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    justifyContent: "center",
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  link: { fontFamily: fonts.headBold, fontSize: 14, letterSpacing: 0.8, color: colors.gold, textTransform: "uppercase" },
  team: { flexDirection: "row", alignItems: "center", gap: 8 },
  swap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 2,
    borderColor: colors.line,
  },
  format: { gap: 4, padding: 14, borderRadius: radius.lg, backgroundColor: colors.deep, borderWidth: 2, borderColor: colors.line },
  formatOn: { borderColor: colors.gold, backgroundColor: colors.raised },
  formatLabel: { fontFamily: fonts.display, fontSize: 20, color: colors.cream },
});
