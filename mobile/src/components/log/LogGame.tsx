/**
 * LogGame
 *
 * The app's log-a-game flow, the same steps as the website's wizard:
 *  1. players — mat (4-mat / 8-mat / 1v1) and who's playing;
 *  2. teams — tap two names to swap, shuffle, balance by Elo, or (beta)
 *     Chwazi with fingers on the names; draws animate for beta users;
 *  3. start — (beta) who starts: cap toss, Chwazi or no preference, plus
 *     the 3-2-1; (beta) switch on logging on the mat;
 *  4. play — the full-screen mat logger (beta), which ends the game itself;
 *  5. result — tap teams in finishing order, count mama hits, mark kruipen
 *     for the losers; save.
 * 1v1 skips the teams step. Locked teams (tournament or Americano game)
 * and presets (Chwazi, rematch) start on step 3.
 *
 * Data: POST /api/v1/games, or `submit` (tournaments, Americano); calls
 *       `onSaved(gameId)` afterwards.
 * Notes: mat games derive kruipen from the rounds (@shared/mat matExtras)
 * and store one classic shot per throw, like the website.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { api, ApiError } from "@/api/client";
import type { CrewDetail } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { format, useT } from "@/lib/i18n";
import { balanceIntoDuos, pairIntoDuos, pairIntoSolos, shortNamesFor, shuffleIntoDuos, type Team } from "@/lib/teams";
import { ZONES, knockedMamas, matExtras, type MatGameLog } from "@shared/mat";
import { Avatar, Button, Kicker, Toggle, Txt } from "@/components/ui";
import { MatLogger } from "@/components/log/MatLogger";
import { MamaShot } from "@/components/beta/MamaShot";
import { CapToss, Countdown, FingerPicker, TeamDraw, TeamFingers } from "@/components/beta/Start";
import { colors, fonts, radius } from "@/theme";

type Mat = "2" | "4" | "8";
type FieldHit = "1" | "2" | "3" | "mama" | "mama_out" | "miss";
type Step = "players" | "teams" | "start" | "play" | "result";
const needFor = (m: Mat) => (m === "8" ? 8 : m === "2" ? 2 : 4);
let keySeq = 0;
/** Fresh key to replay an animation. */
const nextKey = () => ++keySeq;

export type SaveResult = {
  matType: Mat;
  teams: { id: string; label: string; playerIds: string[]; finalRank: number; kruip: boolean }[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
  mat?: MatGameLog;
};

/** Classic shot rows from a mat log: one per real throw, at the spot the
 * thrown cap first landed; a mama shot out later that round is "mama_out". */
function shotsFromMat(log: MatGameLog): { playerId: string; fieldHit: FieldHit }[] {
  const all = log.rounds.flatMap((r) =>
    r.throws.map((t) => ({
      round: r.number,
      capNo: t.capNo,
      playerId: t.playerId,
      skipped: t.kind === "skipped",
      firstSpot: t.moves.find((m) => m.isThrownCap)?.toSpot ?? null,
      moves: t.moves.map((m) => ({ capNo: m.capNo, isThrownCap: m.isThrownCap, from: { spot: m.fromSpot }, to: { spot: m.toSpot } })),
    })),
  );
  const knocked = knockedMamas(all);
  return all.flatMap((t, i) => {
    if (t.skipped) return [];
    const spot = t.firstSpot ?? "miss";
    const z = ZONES.find((x) => x.id === spot);
    const fieldHit: FieldHit = z ? (String(z.v) as FieldHit) : spot === "ML" || spot === "MR" ? (knocked.has(i) ? "mama_out" : "mama") : "miss";
    return [{ playerId: t.playerId, fieldHit }];
  });
}

export function LogGame({
  detail,
  onSaved,
  presetPlayerIds,
  lockedTeams,
  submit,
}: {
  detail: CrewDetail;
  onSaved: (gameId: string) => void;
  /** Ordered player ids from Chwazi or a rematch (pairs for duos). */
  presetPlayerIds?: string[];
  /** Fixed teams (tournament match, Americano game): start step only. */
  lockedTeams?: Team[];
  /** Custom save; resolves with the new game's id (or null: already logged). */
  submit?: (result: SaveResult) => Promise<string | null>;
}) {
  const { t } = useT();
  const { me } = useAuth();
  const beta = me?.beta.features;
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

  const [step, setStep] = useState<Step>(preset ? "start" : "players");
  const [mat, setMat] = useState<Mat>(preset?.mat ?? "4");
  const [picked, setPicked] = useState<string[]>(preset?.ids ?? []);
  const [teams, setTeams] = useState<Team[] | null>(preset?.teams ?? null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [useMat, setUseMat] = useState(Boolean(beta?.mat));
  const [mamas, setMamas] = useState<Record<string, number>>({});
  const [kruip, setKruip] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draw, setDraw] = useState<{ teams: Team[]; mode: "random" | "balanced"; k: number } | null>(null);
  const [fingers, setFingers] = useState(false);
  const [mama, setMama] = useState<{ name: string; team: number; k: number } | null>(null);
  const [startOpt, setStartOpt] = useState<"toss" | "chwazi" | "none">(preset?.teams.length === 2 || mat !== "8" ? "toss" : "chwazi");
  const [countdown, setCountdown] = useState(true);
  const [startOpen, setStartOpen] = useState<null | "toss" | "chwazi" | "count">(null);
  const closeMama = useCallback(() => setMama(null), []);

  const need = needFor(mat);
  const tooFew = roster.length < need;
  const name = (id: string) => short[id] ?? roster.find((p) => p.id === id)?.name ?? "?";
  const teamName = (team: Team) => team.players.map((p) => name(p.id)).join(" & ");
  const pickedPlayers = roster.filter((p) => picked.includes(p.id));

  const matOk = Boolean(beta?.mat) && mat !== "8";
  const playMat = matOk && useMat;
  const flow: Step[] = [
    ...(lockedTeams ? [] : (["players"] as Step[])),
    ...(lockedTeams || mat === "2" ? [] : (["teams"] as Step[])),
    "start",
    ...(playMat ? (["play"] as Step[]) : (["result"] as Step[])),
  ];
  const stepLabel: Record<Step, string> = { players: t.log.stepPlayers, teams: t.log.stepTeams, start: t.log.stepStart, play: t.log.stepPlay, result: t.log.stepResult };

  function pickMat(m: Mat) {
    setMat(m);
    const n = needFor(m);
    const next = roster.length <= n ? roster.map((p) => p.id) : picked.slice(0, n);
    setPicked(next);
    setTeams(null);
  }
  function toggle(id: string) {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= need ? picked : [...picked, id];
    setPicked(next);
    setTeams(null);
  }
  function makeTeams(ids: string[]) {
    const players = roster.filter((p) => ids.includes(p.id));
    return mat === "2" ? pairIntoSolos(players) : shuffleIntoDuos(players);
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
  function drawTeams(mode: "random" | "balanced") {
    const next = mode === "balanced" ? balanceIntoDuos(pickedPlayers, ratings) : shuffleIntoDuos(pickedPlayers);
    setTeams(next);
    setSwapFrom(null);
    if (beta?.start && next.length === 2) setDraw({ teams: next, mode, k: nextKey() });
  }

  function next() {
    const to = flow[flow.indexOf(step) + 1];
    if (!to) return;
    if (step === "players") {
      if (picked.length !== need) return;
      if (!teams) setTeams(makeTeams(picked));
    }
    setOrder([]);
    setStep(to);
  }
  function back() {
    const i = flow.indexOf(step);
    if (i > 0) setStep(flow[i - 1]);
    else router.back();
  }
  function started() {
    setStartOpen(null);
    setStep(playMat ? "play" : "result");
  }
  function start() {
    if (!beta?.start || startOpt === "none") {
      if (beta?.start && countdown) setStartOpen("count");
      else started();
      return;
    }
    setStartOpen(startOpt);
  }
  const afterPick = () => (countdown ? setStartOpen("count") : started());

  function tapTeam(id: string) {
    if (!teams) return;
    if (teams.length === 2) return setOrder([id, teams.find((x) => x.id !== id)!.id]);
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function bump(playerId: string, delta: number) {
    setMamas((prev) => ({ ...prev, [playerId]: Math.max(0, (prev[playerId] ?? 0) + delta) }));
    if (delta > 0 && beta?.celebrations && teams) {
      setMama({ name: name(playerId), team: Math.max(0, teams.findIndex((x) => x.players.some((p) => p.id === playerId))), k: nextKey() });
    }
  }

  // 8-mat: the last unplaced team is implicitly last once the others are tapped.
  const complete = teams ? order.length >= teams.length - 1 : false;
  const finalOrder = teams && complete ? [...order, ...teams.filter((x) => !order.includes(x.id)).map((x) => x.id)] : order;
  const winner = teams?.find((x) => x.id === finalOrder[0]);

  async function persist(result: SaveResult) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
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
                mat: result.mat,
              },
            })
          ).gameId;
      setStep(lockedTeams ? "start" : "players");
      setPicked([]);
      setTeams(lockedTeams ?? null);
      setOrder([]);
      setMamas({});
      setKruip([]);
      if (gameId) onSaved(gameId);
      else router.back();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? t.app.offline : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (!teams || !complete) return;
    void persist({
      matType: mat,
      teams: teams.map((x) => ({
        id: x.id,
        label: x.label,
        playerIds: x.players.map((p) => p.id),
        finalRank: finalOrder.indexOf(x.id) + 1,
        kruip: finalOrder.indexOf(x.id) > 0 && kruip.includes(x.id),
      })),
      shotsByPlayer: Object.entries(mamas).flatMap(([playerId, n]) => Array.from({ length: n }, () => ({ playerId, fieldHit: "mama" as FieldHit }))),
    });
  }
  function saveMat(log: MatGameLog) {
    if (!teams) return;
    const extras = matExtras(log);
    void persist({
      matType: mat,
      teams: teams.map((x, i) => ({
        id: x.id,
        label: x.label,
        playerIds: x.players.map((p) => p.id),
        finalRank: i === log.winnerTeam ? 1 : 2,
        kruip: extras.kruipTeams.includes(i),
      })),
      shotsByPlayer: shotsFromMat(log),
      mat: log,
    });
  }

  if (step === "play" && teams) {
    return (
      <MatLogger
        teams={teams}
        names={Object.fromEntries(teams.flatMap((x) => x.players).map((p) => [p.id, name(p.id)]))}
        saving={saving}
        celebrate={beta?.celebrations}
        onSave={saveMat}
        onClose={() => setStep("start")}
      />
    );
  }

  const at = flow.indexOf(step);
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.between}>
        <Pressable onPress={back} hitSlop={10} style={styles.round} accessibilityLabel={t.common.back}>
          <Txt style={{ fontSize: at > 0 ? 20 : 16 }}>{at > 0 ? "‹" : "✕"}</Txt>
        </Pressable>
        <Txt v="heading" style={styles.title}>
          {t.log.title}
        </Txt>
        {step === "players" ? (
          <Pressable onPress={() => router.push("/chwazi")} style={styles.chwazi}>
            <Txt style={{ fontFamily: fonts.bodySemi, fontSize: 13 }}>🎲 Chwazi</Txt>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        {flow.map((f, i) => (
          <View key={f} style={{ flex: 1, gap: 4 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= at ? colors.gold : colors.chip }} />
            <Text style={[styles.stepLabel, f === step && { color: colors.cream }]}>{stepLabel[f]}</Text>
          </View>
        ))}
      </View>

      {step === "players" && (
        <>
          <View style={styles.mats}>
            {(["4", "8", "2"] as Mat[]).map((m) => (
              <Pressable key={m} onPress={() => pickMat(m)} style={[styles.matBtn, mat === m && { backgroundColor: colors.gold }]} accessibilityState={{ selected: mat === m }}>
                <Text style={[styles.matText, mat === m && { color: colors.ink }]}>{m === "2" ? "1 V 1" : `${m}-MAT`}</Text>
              </Pressable>
            ))}
          </View>
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
          <Button
            label={picked.length === need ? (mat === "2" ? t.log.nextStart : t.log.nextTeams) : format(t.log.pickMore, { n: Math.max(0, need - picked.length) })}
            disabled={picked.length !== need}
            onPress={next}
          />
        </>
      )}

      {step === "teams" && teams && (
        <>
          <Kicker>{t.log.teams}</Kicker>
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
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => drawTeams("random")} style={styles.dashed}>
              <Text style={styles.dashedText}>{`↻ ${t.log.teamShuffle}`}</Text>
            </Pressable>
            <Pressable onPress={() => drawTeams("balanced")} style={styles.dashed}>
              <Text style={styles.dashedText}>{`⚖ ${t.log.teamBalance}`}</Text>
            </Pressable>
            {beta?.start && (
              <Pressable onPress={() => setFingers(true)} style={[styles.dashed, { backgroundColor: colors.gold, borderStyle: "solid", borderColor: colors.gold }]}>
                <Text style={[styles.dashedText, { color: colors.ink }]}>✋ Chwazi</Text>
              </Pressable>
            )}
          </View>
          <Button label={t.log.nextStart} onPress={next} />
        </>
      )}

      {step === "start" && teams && (
        <>
          <View style={styles.vs}>
            {teams.map((team, i) => (
              <View key={team.id} style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 8 }}>
                {i > 0 && <Text style={styles.vsText}>VS</Text>}
                <Text style={[styles.vsTeam, i > 0 && { textAlign: "right" }]}>{teamName(team)}</Text>
              </View>
            ))}
          </View>

          {beta?.start && (
            <View style={{ gap: 8 }}>
              <Kicker>{t.beta.start.whoStarts}</Kicker>
              {([...(teams.length === 2 ? (["toss"] as const) : []), "chwazi", "none"] as const).map((o) => {
                const on = o === startOpt;
                const title = o === "toss" ? t.beta.start.capToss : o === "chwazi" ? "Chwazi" : t.beta.start.noPref;
                const desc = o === "toss" ? t.beta.start.optTossDesc : o === "chwazi" ? t.beta.start.optChwaziDesc : t.beta.start.noPrefDesc;
                return (
                  <Pressable key={o} onPress={() => setStartOpt(o)} style={[styles.option, on && { borderColor: colors.gold }]} accessibilityState={{ selected: on }}>
                    <View style={[styles.radio, on && { borderColor: colors.gold }]}>{on && <View style={styles.radioDot} />}</View>
                    <View style={{ flex: 1 }}>
                      <Txt v="bodySemi">{title}</Txt>
                      <Txt style={styles.small}>{desc}</Txt>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => setCountdown((x) => !x)} style={styles.option}>
                <View style={{ flex: 1 }}>
                  <Txt v="bodySemi">{t.beta.start.cdTitle}</Txt>
                  <Txt style={styles.small}>{t.beta.start.cdDesc}</Txt>
                </View>
                <Toggle on={countdown} />
              </Pressable>
            </View>
          )}

          {matOk && (
            <Pressable onPress={() => setUseMat((v) => !v)} style={styles.option} accessibilityState={{ checked: useMat }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Txt v="bodySemi">{t.mat.useMat}</Txt>
                  <Text style={styles.betaPill}>{t.beta.pill}</Text>
                </View>
                <Txt style={styles.small}>{t.mat.useMatSub}</Txt>
              </View>
              <Toggle on={useMat} />
            </Pressable>
          )}

          <Button label={playMat ? t.beta.start.startGame : beta?.start ? t.beta.start.startGame : t.log.nextResult} onPress={start} />
        </>
      )}

      {step === "result" && teams && (
        <>
          <Kicker>{teams.length > 2 ? t.log.tapOrder : t.log.tapWinnerMama}</Kicker>
          {teams.map((team) => {
            const r = finalOrder.indexOf(team.id);
            const placed = r > -1 && (order.includes(team.id) || complete);
            const first = placed && r === 0;
            const record = team.players.length === 2 ? duoRecords[team.players.map((p) => p.id).sort().join("|")] : undefined;
            const kr = kruip.includes(team.id);
            return (
              <View key={team.id} style={[styles.resultTeam, first && { borderColor: colors.gold }]}>
                <Pressable onPress={() => tapTeam(team.id)} style={styles.resultHead}>
                  <View style={{ flex: 1 }}>
                    <Txt style={styles.teamName}>{teamName(team)}</Txt>
                    {record && <Txt style={styles.small}>{format(t.log.together, { r: record })}</Txt>}
                  </View>
                  <View style={[styles.badge, first ? { backgroundColor: colors.gold } : placed ? { backgroundColor: colors.cream } : null]}>
                    <Text style={[styles.badgeText, placed && { color: colors.ink }]}>
                      {placed ? (teams.length > 2 ? ORD[r] : r === 0 ? t.log.winner : t.log.lost) : teams.length > 2 ? format(t.more.tapOrd, { o: ORD[order.length] }) : t.log.tapWin}
                    </Text>
                  </View>
                </Pressable>
                {team.players.map((p) => {
                  const n = mamas[p.id] ?? 0;
                  return (
                    <View key={p.id} style={styles.playerRow}>
                      <Avatar name={p.name} size={28} />
                      <Txt v="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
                        {name(p.id)}
                      </Txt>
                      <Pressable onPress={() => bump(p.id, -1)} accessibilityLabel={t.log.mamaLess} style={styles.stepper}>
                        <Txt style={styles.stepperText}>−</Txt>
                      </Pressable>
                      <Txt style={[styles.mama, n > 0 && { color: colors.red }]}>{n}</Txt>
                      <Pressable onPress={() => bump(p.id, 1)} accessibilityLabel={t.log.mamaMore} style={[styles.stepper, styles.stepperPlus]}>
                        <Txt style={[styles.stepperText, { color: colors.redPale }]}>+</Txt>
                      </Pressable>
                    </View>
                  );
                })}
                {placed && r > 0 && (
                  <Pressable
                    onPress={() => setKruip((prev) => (kr ? prev.filter((x) => x !== team.id) : [...prev, team.id]))}
                    style={[styles.playerRow, { minHeight: 48 }]}
                    accessibilityState={{ checked: kr }}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt v="bodySemi" style={{ fontSize: 14 }}>
                        {t.log.kruip}
                      </Txt>
                      <Txt style={styles.small}>{t.log.kruipSub}</Txt>
                    </View>
                    <Toggle on={kr} tone="red" />
                  </Pressable>
                )}
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
                  : teams.length > 2
                    ? t.log.setOrder
                    : t.log.pickWinner
            }
            disabled={!complete}
            loading={saving}
            onPress={save}
          />
        </>
      )}

      {draw && draw.teams.length === 2 && (
        <TeamDraw
          key={draw.k}
          teamA={draw.teams[0].players.map((p) => name(p.id))}
          teamB={draw.teams[1].players.map((p) => name(p.id))}
          sub={draw.mode === "balanced" ? t.chwazi.balanced : t.chwazi.luck}
          onAgain={() => drawTeams(draw.mode)}
          onClose={() => setDraw(null)}
          doneLabel={t.beta.start.useTeams}
          onDone={() => setDraw(null)}
        />
      )}
      {fingers && (
        <TeamFingers
          players={pickedPlayers.map((p) => ({ id: p.id, name: name(p.id) }))}
          onClose={() => setFingers(false)}
          doneLabel={t.beta.start.useTeams}
          onDone={(ids) => {
            setTeams(pairIntoDuos(ids.map((id) => pickedPlayers.find((p) => p.id === id)!)));
            setFingers(false);
          }}
        />
      )}
      {startOpen === "toss" && teams && teams.length === 2 && (
        <CapToss teamA={teamName(teams[0])} teamB={teamName(teams[1])} onClose={() => setStartOpen(null)} onDone={afterPick} />
      )}
      {startOpen === "chwazi" && (
        <FingerPicker onClose={() => setStartOpen(null)} doneLabel={countdown ? t.beta.start.startCountdown : t.beta.start.startGame} onDone={afterPick} />
      )}
      {startOpen === "count" && teams && <Countdown label={teams.map(teamName).join("  vs  ")} onDone={started} />}
      {mama && <MamaShot key={mama.k} name={mama.name} team={mama.team} onDone={closeMama} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  title: { fontSize: 22, letterSpacing: 1.6 },
  chwazi: { height: 34, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  stepLabel: { fontFamily: fonts.headBold, fontSize: 11, letterSpacing: 0.9, color: colors.muted, textTransform: "uppercase" },
  mats: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  matBtn: { flex: 1, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  matText: { fontFamily: fonts.headBold, fontSize: 17, letterSpacing: 0.6, color: colors.muted },
  count: { fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  player: { width: "31.5%", minHeight: 56, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.deep, borderWidth: 2, borderColor: "transparent" },
  playerOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  small: { fontSize: 12, color: colors.muted },
  teamBox: { gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  swapChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: radius.md, backgroundColor: colors.raised, borderWidth: 2, borderColor: "transparent" },
  dashed: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(243,241,234,0.25)", alignItems: "center", justifyContent: "center" },
  dashedText: { fontFamily: fonts.headBold, fontSize: 14, letterSpacing: 1, color: colors.soft, textTransform: "uppercase" },
  vs: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  vsText: { fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  vsTeam: { flex: 1, fontFamily: fonts.headBold, fontSize: 17, color: colors.cream },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 2, borderColor: "transparent" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#6e6e6a", alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  betaPill: { fontFamily: fonts.headBold, fontSize: 10, letterSpacing: 0.8, color: colors.ink, backgroundColor: colors.gold, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  resultTeam: { borderRadius: 16, backgroundColor: colors.deep, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },
  resultHead: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  teamName: { fontFamily: fonts.headBold, fontSize: 19, color: colors.cream },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.raised },
  badgeText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1.2, color: colors.muted },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(243,241,234,0.06)" },
  stepper: { width: 44, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.lineStrong },
  stepperPlus: { backgroundColor: "rgba(255,107,91,0.13)", borderColor: "rgba(255,107,91,0.4)" },
  stepperText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.cream },
  mama: { width: 26, textAlign: "center", fontFamily: fonts.display, fontSize: 22, color: "#5b6460" },
});
