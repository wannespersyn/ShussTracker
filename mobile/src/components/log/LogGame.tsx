/**
 * LogGame
 *
 * The app's log-a-game flow, same two steps as the website's wizard:
 *  1. setup — mat (4-mat / 8-mat / 1v1), who's playing, teams (random duos,
 *     tap two names to swap, reshuffle);
 *  2. result — tap teams in finishing order (or the winner), count mama hits
 *     or, with shot tracking on, every throw per zone; then save.
 *
 * Data: POST /api/v1/games; calls `onSaved(gameId)` afterwards.
 * Notes: the crew's "track every shot" setting is the default for step 2.
 * Teams picked in Chwazi arrive as `presetPlayerIds` and skip step 1;
 * tournament matches pass `lockedTeams` + their own `submit`.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { api, ApiError } from "@/api/client";
import type { CrewDetail } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { pairIntoDuos, pairIntoSolos, shortNamesFor, shuffleIntoDuos, type Team } from "@/lib/teams";
import { Avatar, Button, Kicker, Segmented, Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

type Mat = "2" | "4" | "8";
type FieldHit = "1" | "2" | "3" | "mama" | "miss";
const ZONES: { hit: FieldHit; label: string }[] = [
  { hit: "1", label: "1" },
  { hit: "2", label: "2" },
  { hit: "3", label: "3" },
  { hit: "mama", label: "M" },
  { hit: "miss", label: "✕" },
];
const needFor = (m: Mat) => (m === "8" ? 8 : m === "2" ? 2 : 4);

export type SaveResult = {
  matType: Mat;
  teams: { id: string; label: string; playerIds: string[]; finalRank: number }[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
};

export function LogGame({
  detail,
  onSaved,
  presetPlayerIds,
  lockedTeams,
  submit,
}: {
  detail: CrewDetail;
  onSaved: (gameId: string) => void;
  /** Ordered player ids from Chwazi (pairs for duos); opens on the result step. */
  presetPlayerIds?: string[];
  /** Fixed teams (tournament match): result step only, no going back. */
  lockedTeams?: Team[];
  /** Custom save (tournament match); resolves with the new game's id. */
  submit?: (result: SaveResult) => Promise<string>;
}) {
  const { t } = useT();
  const ORD = [t.more.ord1, t.more.ord2, t.more.ord3, t.more.ord4];

  // Most active players first, like the website.
  const roster = useMemo(() => [...detail.insights.players].sort((a, b) => b.games - a.games).map((p) => ({ id: p.userId, name: p.name })), [detail]);
  const ratings = useMemo(() => Object.fromEntries(detail.insights.players.map((p) => [p.userId, p.elo])), [detail]);
  const duoRecords = useMemo(() => Object.fromEntries(detail.insights.duos.map((d) => [[d.a.id, d.b.id].sort().join("|"), `${d.wins}–${d.losses}`])), [detail]);
  const short = useMemo(() => shortNamesFor(roster), [roster]);
  const [preset] = useState(() => {
    if (lockedTeams) {
      const n = lockedTeams.reduce((k, x) => k + x.players.length, 0);
      return { mat: String(n) as Mat, ids: lockedTeams.flatMap((x) => x.players.map((p) => p.id)), teams: lockedTeams };
    }
    const players = (presetPlayerIds ?? []).map((id) => roster.find((p) => p.id === id)).filter((p) => !!p);
    if (![2, 4, 8].includes(players.length) || players.length !== presetPlayerIds?.length) return null;
    return { mat: String(players.length) as Mat, ids: players.map((p) => p.id), teams: players.length === 2 ? pairIntoSolos(players) : pairIntoDuos(players) };
  });

  const [step, setStep] = useState<"setup" | "result">(preset ? "result" : "setup");
  const [mat, setMat] = useState<Mat>(preset?.mat ?? "4");
  const [picked, setPicked] = useState<string[]>(preset?.ids ?? []);
  const [teams, setTeams] = useState<Team[] | null>(preset?.teams ?? null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [zones, setZones] = useState(detail.crew.trackShotZones);
  const [shots, setShots] = useState<Record<string, Partial<Record<FieldHit, number>>>>({});
  const [history, setHistory] = useState<{ playerId: string; hit: FieldHit }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const need = needFor(mat);
  const tooFew = roster.length < need;
  const name = (id: string) => short[id] ?? roster.find((p) => p.id === id)?.name ?? "?";
  const teamName = (team: Team) => team.players.map((p) => name(p.id)).join(" & ");

  function pickMat(m: Mat) {
    setMat(m);
    const n = needFor(m);
    setPicked((prev) => (roster.length <= n ? roster.map((p) => p.id) : prev.slice(0, n)));
    setTeams(null);
  }

  function toggle(id: string) {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= need ? picked : [...picked, id];
    setPicked(next);
    const players = roster.filter((p) => next.includes(p.id));
    setTeams(next.length === need ? (mat === "2" ? pairIntoSolos(players) : shuffleIntoDuos(players)) : null);
    setSwapFrom(null);
  }

  function tapToSwap(playerId: string) {
    if (!teams) return;
    if (!swapFrom || swapFrom === playerId) return setSwapFrom(swapFrom === playerId ? null : playerId);
    const flat = teams.flatMap((x) => x.players);
    const a = flat.find((p) => p.id === swapFrom)!;
    const b = flat.find((p) => p.id === playerId)!;
    setTeams(teams.map((x) => ({ ...x, players: x.players.map((p) => (p.id === a.id ? b : p.id === b.id ? a : p)) })));
    setSwapFrom(null);
  }

  function reshuffle() {
    if (!teams) return;
    setTeams(shuffleIntoDuos(teams.flatMap((x) => x.players)));
    setSwapFrom(null);
  }

  function tapTeam(id: string) {
    if (!teams) return;
    if (teams.length === 2) return setOrder([id, teams.find((x) => x.id !== id)!.id]);
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function bump(playerId: string, hit: FieldHit, delta: number) {
    if (delta > 0) setHistory((h) => [...h, { playerId, hit }]);
    setShots((prev) => {
      const cur = prev[playerId] ?? {};
      return { ...prev, [playerId]: { ...cur, [hit]: Math.max(0, (cur[hit] ?? 0) + delta) } };
    });
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    bump(last.playerId, last.hit, -1);
  }

  // 8-mat: the last unplaced team is implicitly last once the others are tapped.
  const complete = teams ? order.length >= teams.length - 1 : false;
  const finalOrder = teams && complete ? [...order, ...teams.filter((x) => !order.includes(x.id)).map((x) => x.id)] : order;
  const winner = teams?.find((x) => x.id === finalOrder[0]);

  async function save() {
    if (!teams || !complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result: SaveResult = {
        matType: mat,
        teams: teams.map((x) => ({ id: x.id, label: x.label, playerIds: x.players.map((p) => p.id), finalRank: finalOrder.indexOf(x.id) + 1 })),
        shotsByPlayer: Object.entries(shots).flatMap(([playerId, byHit]) =>
          Object.entries(byHit).flatMap(([hit, n]) => Array.from({ length: n ?? 0 }, () => ({ playerId, fieldHit: hit as FieldHit }))),
        ),
      };
      const gameId = submit
        ? await submit(result)
        : (
            await api<{ gameId: string }>("/games", {
              method: "POST",
              body: {
                groupId: detail.crew.id,
                matType: result.matType,
                teams: result.teams.map(({ id: _id, ...x }) => x),
                shotsByPlayer: result.shotsByPlayer,
              },
            })
          ).gameId;
      setStep("setup");
      setPicked([]);
      setTeams(null);
      setOrder([]);
      setShots({});
      setHistory([]);
      onSaved(gameId);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? t.app.offline : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (step === "setup") {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.between}>
          <View style={{ width: 84 }} />
          <Txt v="heading" style={styles.title}>
            {t.log.title}
          </Txt>
          <Pressable onPress={() => router.push("/chwazi")} style={styles.chwazi}>
            <Txt style={{ fontFamily: fonts.bodySemi, fontSize: 13 }}>🎲 Chwazi</Txt>
          </Pressable>
        </View>
        <Segmented
          value={mat}
          onChange={pickMat}
          options={[
            { id: "4", label: "4-MAT" },
            { id: "8", label: "8-MAT" },
            { id: "2", label: "1 V 1" },
          ]}
        />

        {tooFew ? (
          <Txt style={{ color: colors.red }}>{format(t.log.tooFew, { have: roster.length, need })}</Txt>
        ) : (
          <>
            <View style={styles.between}>
              <Kicker>{t.log.whoPlays}</Kicker>
              <Txt style={[styles.count, picked.length === need && { color: colors.gold }]}>{`${picked.length} / ${need}`}</Txt>
            </View>
            <View style={styles.grid}>
              {roster.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <Pressable key={p.id} onPress={() => toggle(p.id)} style={[styles.player, on && styles.playerOn]} accessibilityState={{ selected: on }}>
                    <Txt v="bodySemi" numberOfLines={1} style={{ fontSize: 14 }}>
                      {name(p.id)}
                    </Txt>
                    {ratings[p.id] !== undefined && <Txt style={styles.small}>{ratings[p.id]}</Txt>}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {teams && mat !== "2" && (
          <View style={{ gap: 8 }}>
            <View style={styles.between}>
              <Kicker>{t.log.teams}</Kicker>
              <Pressable onPress={reshuffle} hitSlop={8}>
                <Txt style={styles.link}>{t.chwazi.reshuffle}</Txt>
              </Pressable>
            </View>
            {teams.map((team, i) => (
              <View key={team.id} style={styles.teamBox}>
                <Kicker>{format(t.chwazi.team, { n: i + 1 })}</Kicker>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {team.players.map((p) => (
                    <Pressable key={p.id} onPress={() => tapToSwap(p.id)} style={[styles.swapChip, swapFrom === p.id && styles.playerOn]}>
                      <Avatar name={p.name} size={26} />
                      <Txt v="bodySemi" numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
                        {name(p.id)}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <Button
          label={teams ? t.log.next : format(t.log.pickMore, { n: Math.max(0, need - picked.length) })}
          disabled={!teams}
          onPress={() => {
            setOrder([]);
            setStep("result");
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.between}>
        {lockedTeams ? (
          <View style={{ width: 50 }} />
        ) : (
          <Pressable onPress={() => setStep("setup")} hitSlop={10}>
            <Txt style={styles.link}>‹ {t.common.back}</Txt>
          </Pressable>
        )}
        <Txt v="heading">{t.log.title}</Txt>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.toggle}>
        <View style={{ flex: 1 }}>
          <Txt v="bodySemi" style={{ fontSize: 14 }}>
            {t.log.trackShots}
          </Txt>
          <Txt style={styles.small}>{zones ? t.log.trackOn : t.log.trackOff}</Txt>
        </View>
        <Switch value={zones} onValueChange={setZones} trackColor={{ true: colors.gold, false: colors.chip }} thumbColor={zones ? colors.ink : colors.muted} />
      </View>

      <View style={styles.between}>
        <Kicker style={{ flex: 1 }}>{teams!.length > 2 ? t.log.tapOrder : zones ? t.log.tapWinnerShots : t.log.tapWinnerMama}</Kicker>
        {zones && history.length > 0 && (
          <Pressable onPress={undo} style={styles.undo}>
            <Txt style={{ fontSize: 12, fontFamily: fonts.bodySemi }}>↺ {t.log.undo}</Txt>
          </Pressable>
        )}
      </View>

      {teams!.map((team) => {
        const r = finalOrder.indexOf(team.id);
        const placed = r > -1 && (order.includes(team.id) || complete);
        const first = placed && r === 0;
        const record =
          team.players.length === 2
            ? duoRecords[
                team.players
                  .map((p) => p.id)
                  .sort()
                  .join("|")
              ]
            : undefined;
        return (
          <View key={team.id} style={[styles.resultTeam, first && { borderColor: colors.gold }]}>
            <Pressable onPress={() => tapTeam(team.id)} style={styles.resultHead}>
              <View style={{ flex: 1 }}>
                <Txt style={styles.teamName}>{teamName(team)}</Txt>
                {record && <Txt style={styles.small}>{format(t.log.together, { r: record })}</Txt>}
              </View>
              <View style={[styles.badge, first ? { backgroundColor: colors.gold } : placed ? { backgroundColor: colors.cream } : null]}>
                <Text style={[styles.badgeText, placed && { color: colors.ink }]}>
                  {placed
                    ? teams!.length > 2
                      ? ORD[r]
                      : r === 0
                        ? t.log.winner
                        : t.log.lost
                    : teams!.length > 2
                      ? format(t.more.tapOrd, { o: ORD[order.length] })
                      : t.log.tapWin}
                </Text>
              </View>
            </Pressable>

            {team.players.map((p) => {
              const s = shots[p.id] ?? {};
              const total = ZONES.reduce((n, z) => n + (s[z.hit] ?? 0), 0);
              return (
                <View key={p.id} style={styles.playerRow}>
                  <View style={styles.between}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <Avatar name={p.name} size={28} />
                      <Txt v="bodySemi" numberOfLines={1}>
                        {name(p.id)}
                      </Txt>
                    </View>
                    {zones ? (
                      <Txt style={styles.small}>{`${total} ${t.log.shots}`}</Txt>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Pressable onPress={() => bump(p.id, "mama", -1)} accessibilityLabel={t.log.mamaLess} style={styles.stepper}>
                          <Txt style={styles.stepperText}>−</Txt>
                        </Pressable>
                        <Txt style={[styles.mama, (s.mama ?? 0) > 0 && { color: colors.red }]}>{s.mama ?? 0}</Txt>
                        <Pressable onPress={() => bump(p.id, "mama", 1)} accessibilityLabel={t.log.mamaMore} style={[styles.stepper, styles.stepperPlus]}>
                          <Txt style={[styles.stepperText, { color: colors.redPale }]}>+</Txt>
                        </Pressable>
                      </View>
                    )}
                  </View>
                  {zones && (
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {ZONES.map((z) => {
                        const n = s[z.hit] ?? 0;
                        const on = n > 0;
                        return (
                          <Pressable
                            key={z.hit}
                            onPress={() => bump(p.id, z.hit, 1)}
                            accessibilityLabel={`${z.label} — ${name(p.id)}`}
                            style={[
                              styles.zone,
                              on && { backgroundColor: z.hit === "mama" ? colors.red : z.hit === "miss" ? "rgba(243,241,234,0.4)" : colors.cream },
                            ]}
                          >
                            <Text style={[styles.zoneLabel, { color: on ? colors.ink : z.hit === "mama" ? colors.red : colors.soft }]}>{z.label}</Text>
                            <Text style={[styles.zoneCount, { color: on ? colors.ink : colors.muted }]}>{n}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      <Txt style={[styles.small, { textAlign: "center" }]}>
        {format(t.log.countsFor, {
          time: new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
          crew: detail.crew.name,
        })}
      </Txt>
      {error && <Txt style={{ color: colors.redPale, textAlign: "center" }}>{error}</Txt>}
      <Button
        label={
          saving
            ? t.log.saving
            : complete && winner
              ? format(t.log.save, { name: teamName(winner).toUpperCase() })
              : teams!.length > 2
                ? t.log.setOrder
                : t.log.pickWinner
        }
        disabled={!complete}
        loading={saving}
        onPress={save}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  title: { textAlign: "center", fontSize: 24 },
  chwazi: {
    width: 84,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  count: { fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  player: {
    width: "31.5%",
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.deep,
    borderWidth: 2,
    borderColor: "transparent",
  },
  playerOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  small: { fontSize: 12, color: colors.muted },
  link: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 0.8, color: colors.gold, textTransform: "uppercase" },
  teamBox: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  swapChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
    borderWidth: 2,
    borderColor: "transparent",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  undo: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  resultTeam: {
    borderRadius: 16,
    backgroundColor: colors.deep,
    borderWidth: 2,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  resultHead: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  teamName: { fontFamily: fonts.headBold, fontSize: 19, color: colors.cream },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.raised },
  badgeText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.2, color: colors.muted },
  playerRow: { gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(243,241,234,0.06)" },
  stepper: {
    width: 44,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  stepperPlus: { backgroundColor: "rgba(255,107,91,0.13)", borderColor: "rgba(255,107,91,0.4)" },
  stepperText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.cream },
  mama: { width: 26, textAlign: "center", fontFamily: fonts.display, fontSize: 22, color: "#5b6460" },
  zone: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  zoneLabel: { fontFamily: fonts.display, fontSize: 15 },
  zoneCount: { fontFamily: fonts.bodyBold, fontSize: 11 },
});
