/**
 * MatLogger (beta)
 *
 * The website's mat logger in the app: full screen, the mat from above. Each
 * turn you tap where the thrower's cap landed (or drag it), tap other caps it
 * hit and where they ended up, then "Throw done"; the app follows the turn
 * order, extra throws from shooting boxes, jokers, ad fundum and the drinking
 * per round. The game ends when a team has emptied its pints and everything
 * goes to `onSave` as a MatGameLog.
 *
 * Data: rules and geometry from the website's lib/mat.ts (@shared/mat).
 * Notes: no camera linking in the app; the help sheet is shown until
 * "don't show again".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Polygon, Rect, Text as SvgText } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import {
  BOTTLES,
  CORNERS,
  FIELD_OUTLINE,
  MAMAS,
  ZONES,
  dropCap,
  drunk,
  finishThrow,
  knockedMamas,
  mamaTeam,
  newMatState,
  nextRound,
  placeA1,
  playJoker,
  spotOf,
  teamOfSlot,
  toGameLog,
  turnInfo,
  zoneTeam,
  type Corner,
  type MatGameLog,
  type MatState,
  type Slot,
  type Spot,
} from "@shared/mat";
import { format, useT } from "@/lib/i18n";
import type { Team } from "@/lib/teams";
import { MamaShot } from "@/components/beta/MamaShot";
import { colors, fonts, radius } from "@/theme";

const HELP_KEY = "shuss.matHelpHidden";
const TEAM_FILL = ["#EFE7D3", "#5FB7FF"];
const TEAM_STROKE = ["#C9A55A", "#2f6fa3"];
/** Mat drawing: landscape mat space rotated upright (viewBox 0 -22 265 868). */
const VB_W = 265;
const VB_H = 868;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function MatLogger({
  teams,
  names,
  saving,
  celebrate,
  onSave,
  onClose,
}: {
  teams: Team[];
  names: Record<string, string>;
  saving?: boolean;
  celebrate?: boolean;
  onSave: (log: MatGameLog) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const M = t.mat;
  const solo = teams[0].players.length === 1;
  const [st, setSt] = useState<MatState>(() => newMatState(solo));
  const [history, setHistory] = useState<MatState[]>([]);
  const [slots, setSlots] = useState<Record<Slot, string | undefined>>({
    a1: teams[0].players[0]?.id,
    a2: teams[0].players[1]?.id,
    b1: teams[1].players[0]?.id,
    b2: teams[1].players[1]?.id,
  });
  const [dialog, setDialog] = useState<null | "help" | "setup" | "pints" | "end">(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [mama, setMama] = useState<{ name: string; team: number; k: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Opens on the explainer unless the player chose "don't show again".
  useEffect(() => {
    SecureStore.getItemAsync(HELP_KEY)
      .then((v) => v !== "1" && setDialog("help"))
      .catch(() => setDialog("help"));
  }, []);

  const nameOf = (s: Slot) => names[slots[s] ?? ""] ?? s.toUpperCase();
  const teamName = (ti: number) =>
    (ti === 0 ? (["a1", "a2"] as Slot[]) : (["b1", "b2"] as Slot[]))
      .filter((s) => slots[s])
      .map(nameOf)
      .join(" & ");

  function apply(fn: (draft: MatState) => boolean | void, remember = true) {
    const draft = clone(st);
    if (fn(draft) === false) return;
    if (remember) setHistory((h) => [...h, st]);
    setSt(draft);
  }
  function throwDone(miss: boolean) {
    apply((d) => {
      const ok = finishThrow(d, miss);
      const last = d.throws.filter((x) => x.kind !== "skipped").at(-1);
      if (ok && celebrate && last?.moves.some((m) => m.to.spot === "ML" || m.to.spot === "MR")) {
        setMama({ name: nameOf(last.slot), team: teamOfSlot(last.slot), k: d.throws.length });
      }
      return ok;
    });
    setSelected(null);
  }
  function undo() {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setSt(prev);
    setSelected(null);
  }

  /* ---------- labels ---------- */
  const spotLabel = (s: Spot, short = false) => {
    const forTeam = (ti: number) => (short ? format(M.forTeamShort, { t: "AB"[ti] }) : format(M.forTeam, { team: teamName(ti) }));
    switch (s.kind) {
      case "zone":
        return `${format(M.spotZone, { v: s.v })} ${forTeam(zoneTeam(st, s.id))}`;
      case "mama":
        return `${M.spotMama} ${forTeam(mamaTeam(st, s.id))}`;
      case "box":
        return format(M.spotBox, { name: nameOf(s.slot) });
      case "off":
        return M.spotOff;
      case "none":
        return M.spotNone;
      default:
        return M.spotWaiting;
    }
  };
  const codeLabel = (code: string) => {
    if (code === "miss") return M.miss.toLowerCase();
    const z = ZONES.find((x) => x.id === code);
    if (z) return spotLabel({ kind: "zone", id: z.id, v: z.v });
    if (code === "ML" || code === "MR") return spotLabel({ kind: "mama", id: code });
    if (code.startsWith("box:")) return spotLabel({ kind: "box", slot: code.slice(4) as Slot });
    return code === "off" ? M.spotOff : code === "none" ? M.spotNone : M.spotWaiting;
  };

  /* ---------- totals & awards ---------- */
  const totals = useMemo(() => {
    const tot = [
      { sips: 0, af: 0 },
      { sips: 0, af: 0 },
    ];
    for (const raw of st.results) {
      const r = drunk(raw);
      r.sips.forEach((n, ti) => (tot[ti].sips += n));
      for (const ti of r.mamaTeams) tot[ti].af++;
      if (r.allDrink) {
        tot[0].af++;
        tot[1].af++;
      }
    }
    return tot;
  }, [st.results]);
  const knocked = useMemo(() => knockedMamas(st.throws), [st.throws]);
  const awards = useMemo(() => {
    const per = {} as Record<Slot, { three: number; mama: number; knocks: number; miss: number; mamaOut: number }>;
    for (const s of st.order) per[s] = { three: 0, mama: 0, knocks: 0, miss: 0, mamaOut: 0 };
    st.throws.forEach((th, i) => {
      if (th.kind === "skipped") return;
      const x = per[th.slot];
      if (th.firstSpot && ZONES.find((z) => z.id === th.firstSpot)?.v === 3) x.three++;
      if ((th.firstSpot === "ML" || th.firstSpot === "MR") && !knocked.has(i)) x.mama++;
      x.mamaOut += th.moves.filter((m) => !m.isThrownCap && (m.from.spot === "ML" || m.from.spot === "MR") && m.to.spot !== "ML" && m.to.spot !== "MR").length;
      if (th.missed || th.firstSpot === "off") x.miss++;
      x.knocks += th.moves.filter((m) => !m.isThrownCap && teamOfSlot(m.owner) !== teamOfSlot(th.slot)).length;
    });
    return (
      [
        ["three", M.awThree, "🎯"],
        ["knocks", M.awKnocks, "💥"],
        ["mamaOut", M.awMamaOut, "🛡"],
        ["mama", M.awMama, "🔴"],
        ["miss", M.awMiss, "🙈"],
      ] as const
    )
      .map(([k, txt, icon]) => {
        const best = st.order.slice().sort((a, b) => per[b][k] - per[a][k])[0];
        return per[best][k] > 0 ? { icon: icon as string, txt: txt as string, name: nameOf(best), n: per[best][k] } : null;
      })
      .filter((x): x is { icon: string; txt: string; name: string; n: number } => !!x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.throws, slots, knocked]);

  /* ---------- touch: tap = place / select, drag = move a cap ---------- */
  const scale = size.w / VB_W;
  /** Screen point inside the mat view → logger (landscape) coordinates. */
  const toMat = (lx: number, ly: number) => {
    const sx = lx / scale;
    const sy = ly / scale - 22;
    return { x: sy, y: VB_W - sx };
  };
  const stRef = useRef(st);
  const selRef = useRef(selected);
  useEffect(() => {
    stRef.current = st;
    selRef.current = selected;
  });
  const press = useRef<{ no: number | null; x0: number; y0: number; dx: number; dy: number; moved: boolean; before: MatState } | null>(null);

  const capAt = (p: { x: number; y: number }) => {
    let best: { no: number; d: number } | null = null;
    for (const c of stRef.current.caps) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d <= 30 && (!best || d < best.d)) best = { no: c.no, d };
    }
    return best?.no ?? null;
  };

  // The handlers only read the refs when a touch happens, never during render.
  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => stRef.current.phase === "throw",
        onMoveShouldSetPanResponder: () => stRef.current.phase === "throw",
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          const p = toMat(locationX, locationY);
          const no = capAt(p);
          const c = no !== null ? stRef.current.caps.find((x) => x.no === no) : undefined;
          press.current = { no, x0: locationX, y0: locationY, dx: c ? c.x - p.x : 0, dy: c ? c.y - p.y : 0, moved: false, before: stRef.current };
        },
        onPanResponderMove: (e, g) => {
          const d = press.current;
          if (!d || d.no === null) return;
          if (!d.moved && Math.hypot(g.dx, g.dy) < 6) return;
          d.moved = true;
          const p = toMat(d.x0 + g.dx, d.y0 + g.dy);
          const no = d.no;
          setSt((cur) => ({ ...cur, caps: cur.caps.map((c) => (c.no === no ? { ...c, x: Math.round(p.x + d.dx), y: Math.round(p.y + d.dy), waiting: false } : c)) }));
        },
        onPanResponderRelease: (_e, g) => {
          const d = press.current;
          press.current = null;
          if (!d) return;
          if (d.no !== null && d.moved) {
            const no = d.no;
            setHistory((h) => [...h, d.before]);
            setSt((cur) => {
              const draft = clone(cur);
              dropCap(draft, no);
              return draft;
            });
            setSelected(null);
            return;
          }
          if (d.no !== null) {
            const no = d.no;
            setSelected((cur) => (no === stRef.current.activeCap || cur === no ? null : no));
            return;
          }
          const target = selRef.current ?? stRef.current.activeCap;
          if (target === null) return;
          const p = toMat(d.x0 + g.dx, d.y0 + g.dy);
          setHistory((h) => [...h, d.before]);
          setSt((cur) => {
            const draft = clone(cur);
            const c = draft.caps.find((x) => x.no === target);
            if (!c) return cur;
            Object.assign(c, { x: Math.round(p.x), y: Math.round(p.y), waiting: false });
            dropCap(draft, target);
            return draft;
          });
          setSelected(null);
        },
        onPanResponderTerminate: () => {
          press.current = null;
        },
      }),
    // toMat depends on the measured size only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale],
  );

  function onMatArea(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.min(width, (height * VB_W) / VB_H);
    if (Math.abs(w - size.w) > 0.5) setSize({ w, h: (w * VB_H) / VB_W });
  }

  /* ---------- render ---------- */
  const inf = turnInfo(st);
  const active = st.phase === "throw" ? st.thrower : null;
  const myCap = st.caps.find((c) => c.no === st.activeCap);
  const placed = Boolean(myCap && !myCap.waiting);
  const lastResult = st.results.at(-1);
  const sips = (n: number) => (n === 1 ? M.sipsOne : format(M.sipsN, { n }));
  const rot = (x: number, y: number) => `rotate(-90 ${x} ${y})`;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <Round onPress={onClose} label={M.close}>
          ✕
        </Round>
        <Text style={styles.round}>
          {`${M.round} `}
          <Text style={{ color: colors.gold }}>{st.round}</Text>
        </Text>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 6 }}>
          {[0, 1].map((ti) => (
            <View key={ti} style={styles.score}>
              <View style={[styles.dot, { backgroundColor: TEAM_FILL[ti] }]} />
              <Text style={styles.scoreN}>{totals[ti].sips}</Text>
              {totals[ti].af > 0 && <Text style={styles.af}>{`${totals[ti].af}×M`}</Text>}
              {!st.jokersUsed.includes(ti) && <Text style={{ fontSize: 11 }}>🃏</Text>}
            </View>
          ))}
        </View>
        {history.length > 0 && (
          <Round onPress={undo} label={M.undo}>
            ↺
          </Round>
        )}
        <Round onPress={() => setDialog("pints")} label={M.pintsBtn} gold>
          🍺
        </Round>
        <Round onPress={() => setDialog("setup")} label={M.lineup}>
          👥
        </Round>
        <Round onPress={() => setDialog("help")} label={M.help}>
          ?
        </Round>
      </View>

      <View style={styles.strip}>
        {st.order.map((s) => {
          const spent = inf.count[s] >= inf.allowed[s] && s !== active;
          const plus = inf.allowed[s] > 1 && inf.count[s] < inf.allowed[s] ? "+1" : "";
          const on = s === active;
          return (
            <View key={s} style={[styles.turn, on && { backgroundColor: colors.gold, borderColor: colors.gold }, spent && { borderStyle: "dashed", backgroundColor: "transparent" }]}>
              <Text style={[styles.turnSlot, on && { color: colors.ink }]}>{`${s.toUpperCase()}${plus}`}</Text>
              <Text numberOfLines={1} style={[styles.turnName, on && { color: colors.ink }, spent && { color: colors.muted, textDecorationLine: "line-through" }]}>
                {nameOf(s)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.matArea} onLayout={onMatArea}>
        {size.w > 0 && (
          <View style={{ width: size.w, height: size.h }} {...responder.panHandlers} accessibilityLabel={M.matAlt}>
            <Svg width={size.w} height={size.h} viewBox={`0 -22 ${VB_W} ${VB_H}`}>
              <G transform={`translate(${VB_W} 0) rotate(90)`}>
                <Polygon points={FIELD_OUTLINE.map((p) => p.join(",")).join(" ")} fill="#0E1012" stroke="#E0A43A" strokeWidth={6} strokeLinejoin="round" />
                {MAMAS.map((m) => (
                  <Rect key={m.id} x={m.x} y={m.y} width={m.w} height={m.h} fill="#E3101E" />
                ))}
                {ZONES.map((z) => {
                  const cx = z.pts.reduce((a, p) => a + p[0], 0) / z.pts.length;
                  const cy = z.pts.reduce((a, p) => a + p[1], 0) / z.pts.length;
                  return (
                    <G key={z.id}>
                      <Polygon points={z.pts.map((p) => p.join(",")).join(" ")} fill="#E0A43A" />
                      <SvgText x={cx} y={cy + 10} textAnchor="middle" fill="#3a2706" opacity={0.5} fontSize={30} fontWeight="800" transform={rot(cx, cy)}>
                        {String(z.v)}
                      </SvgText>
                    </G>
                  );
                })}
                {BOTTLES.map(([x, y]) => (
                  <Circle key={`${x}-${y}`} cx={x} cy={y} r={19} fill="#4A2A1C" stroke="#2A160E" strokeWidth={3} />
                ))}
                {st.order.map((s) => {
                  const pts = CORNERS[st.corner[s]!].pts;
                  const cx = (pts[0][0] * 2 + pts[1][0] + pts[2][0]) / 4;
                  const cy = (pts[0][1] * 2 + pts[1][1] + pts[2][1]) / 4;
                  return (
                    <G key={s}>
                      <Polygon points={pts.map((p) => p.join(",")).join(" ")} fill="#E0A43A" />
                      {!st.caps.some((c) => c.waiting && c.owner === s) && (
                        <SvgText x={cx} y={cy + 4} textAnchor="middle" fill="#3a2706" fontSize={13} fontWeight="800" transform={rot(cx, cy)}>
                          {s.toUpperCase()}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
                {st.caps.map((c) => {
                  const sp = spotOf(st, c);
                  const ti = sp.kind === "zone" ? zoneTeam(st, sp.id) : sp.kind === "mama" ? mamaTeam(st, sp.id) : teamOfSlot(c.owner);
                  const isActive = st.phase === "throw" && c.no === st.activeCap;
                  return (
                    <G key={c.no} transform={`translate(${c.x} ${c.y})`}>
                      {isActive && <Circle r={25} fill="none" stroke="#E0A43A" strokeWidth={3.5} strokeDasharray="5 5" opacity={selected !== null ? 0.4 : 1} />}
                      {selected === c.no && <Circle r={26} fill="none" stroke="#E0A43A" strokeWidth={5} />}
                      {sp.kind === "mama" ? (
                        <>
                          <Circle r={22} fill="none" stroke={TEAM_FILL[ti]} strokeWidth={3} />
                          <Circle r={16} fill="#ff2a36" stroke="#ffffff" strokeWidth={3} />
                        </>
                      ) : (
                        <Circle r={16} fill={TEAM_FILL[ti]} stroke={TEAM_STROKE[ti]} strokeWidth={3} />
                      )}
                      <SvgText x={0} y={5} textAnchor="middle" fill="#14100a" fontSize={15} fontWeight="800" transform="rotate(-90)">
                        {c.owner.toUpperCase()}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            </Svg>
          </View>
        )}
      </View>

      <View style={styles.dock}>
        {st.phase === "done" && lastResult ? (
          <>
            <Text style={styles.drinkTitle}>{format(M.drinkTitle, { n: lastResult.round })}</Text>
            <View style={[{ gap: 8 }, lastResult.jokerTeam !== null && { opacity: 0.4 }]}>
              {lastResult.mamaTeams.length ? (
                <>
                  {lastResult.mamaTeams.map((ti) => (
                    <Text key={ti} style={styles.redLine}>
                      {format(M.mamaLine, { team: teamName(ti) })}
                    </Text>
                  ))}
                  <Text style={styles.small}>{M.mamaNoSips}</Text>
                </>
              ) : lastResult.allDrink ? (
                <>
                  <Text style={styles.redLine}>{format(M.allDrink, { n: lastResult.emptyStreak })}</Text>
                  <Text style={styles.small}>{M.allDrinkSub}</Text>
                </>
              ) : (
                [0, 1].map((ti) => (
                  <View key={ti} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.dot, { backgroundColor: TEAM_FILL[ti] }]} />
                    <Text numberOfLines={1} style={[styles.body, { flex: 1 }]}>
                      {teamName(ti)}
                    </Text>
                    <Text style={styles.sips}>{sips(lastResult.sips[ti])}</Text>
                  </View>
                ))
              )}
            </View>
            {!lastResult.allDrink && lastResult.emptyStreak > 0 && lastResult.jokerTeam === null && (
              <Text style={[styles.small, { color: colors.gold }]}>{format(M.emptyStreak, { n: lastResult.emptyStreak, left: 3 - lastResult.emptyStreak })}</Text>
            )}
            {lastResult.jokerTeam !== null ? (
              <Text style={[styles.body, { color: colors.gold, fontFamily: fonts.bodyBold }]}>{format(M.jokerUsed, { team: teamName(lastResult.jokerTeam) })}</Text>
            ) : (
              [0, 1].some((ti) => !st.jokersUsed.includes(ti)) && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[0, 1].map((ti) =>
                    st.jokersUsed.includes(ti) ? (
                      <View key={ti} style={[styles.joker, { borderStyle: "dashed", borderColor: colors.line }]}>
                        <Text style={styles.small}>{M.jokerGone}</Text>
                      </View>
                    ) : (
                      <Pressable key={ti} onPress={() => apply((d) => playJoker(d, ti))} style={styles.joker}>
                        <Text numberOfLines={1} style={[styles.body, { fontSize: 13, fontFamily: fonts.bodySemi }]}>
                          {`🃏 ${format(M.jokerBtn, { team: teamName(ti) })}`}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              )
            )}
            <Pressable onPress={() => apply((d) => nextRound(d))} style={styles.primary}>
              <Text style={styles.primaryText}>{M.nextRound}</Text>
            </Pressable>
          </>
        ) : active && myCap ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={[styles.slotTag, { backgroundColor: TEAM_FILL[teamOfSlot(active)] }]}>{active.toUpperCase()}</Text>
              <Text numberOfLines={1} style={styles.thrower}>
                {nameOf(active)}
              </Text>
              <Text numberOfLines={1} style={[styles.small, { marginLeft: "auto", flexShrink: 1 }]}>
                {`${M.cap}: `}
                <Text style={{ color: colors.cream, fontFamily: fonts.bodySemi }}>{spotLabel(spotOf(st, myCap), true)}</Text>
              </Text>
            </View>
            <Text style={[styles.small, inf.count[active] >= 1 && { color: colors.gold }]}>
              {selected !== null
                ? format(M.selHint, { name: nameOf(st.caps.find((c) => c.no === selected)?.owner ?? active) })
                : inf.count[active] >= 1 && !placed
                  ? M.bonusHint
                  : placed
                    ? M.movedHint
                    : M.dropHint}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => throwDone(true)} style={[styles.secondary, { flex: 1 }]}>
                <Text style={styles.secondaryText}>{M.miss}</Text>
              </Pressable>
              <Pressable onPress={() => placed && throwDone(false)} style={[styles.primary, { flex: 2 }, !placed && { opacity: 0.4 }]}>
                <Text style={styles.primaryText}>{M.done}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <Pressable onPress={() => setLogOpen(true)} hitSlop={6}>
          <Text style={[styles.small, { textAlign: "center" }]}>{`${M.log} · ${format(M.logCount, { n: st.throws.length, r: st.results.length })} ▾`}</Text>
        </Pressable>
      </View>

      {mama && <MamaShot key={mama.k} name={mama.name} team={mama.team} onDone={() => setMama(null)} />}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={M.log} closeLabel={M.close}>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10 }}>
          {Array.from({ length: st.round }, (_, i) => st.round - i).map((r) => {
            const th = st.throws.filter((x) => x.round === r);
            if (!th.length) return null;
            return (
              <View key={r} style={{ gap: 4 }}>
                <Text style={styles.kicker}>{`${M.round} ${r}`}</Text>
                {th.map((x, i) => (
                  <View key={i} style={styles.logRow}>
                    <Text style={[styles.kicker, { width: 26 }]}>{x.slot.toUpperCase()}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.body}>{nameOf(x.slot)}</Text>
                      {x.moves
                        .filter((m) => !m.isThrownCap)
                        .map((m, j) => (
                          <Text key={j} style={styles.small}>
                            {format(M.knocked, { name: nameOf(m.owner), to: codeLabel(m.to.spot) })}
                          </Text>
                        ))}
                    </View>
                    <Text style={[styles.body, { fontFamily: fonts.headBold }]}>
                      {x.kind === "skipped"
                        ? x.skipReason === "cap_knocked"
                          ? M.skipKnocked
                          : M.skipBox
                        : knocked.has(st.throws.indexOf(x))
                          ? M.mamaOut
                          : codeLabel(x.firstSpot ?? "none")}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </Sheet>

      <Sheet open={dialog === "help"} onClose={() => setDialog(null)} title={M.helpTitle} closeLabel={M.close}>
        {(
          [
            ["1", M.help1],
            ["2", M.help2],
            ["3", M.help3],
            ["+1", M.help4],
            ["🍺", M.help5],
          ] as const
        ).map(([ic, txt]) => (
          <View key={ic} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={styles.helpIcon}>
              <Text style={{ fontFamily: fonts.headBold, color: colors.gold, fontSize: 13 }}>{ic}</Text>
            </View>
            <Text style={[styles.body, { flex: 1, fontSize: 14, lineHeight: 20 }]}>{txt}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              SecureStore.setItemAsync(HELP_KEY, "1").catch(() => {});
              setDialog(null);
            }}
            style={[styles.secondary, { flex: 1 }]}
          >
            <Text style={styles.secondaryText}>{M.helpHide}</Text>
          </Pressable>
          <Pressable onPress={() => setDialog(null)} style={[styles.primary, { flex: 1 }]}>
            <Text style={styles.primaryText}>{M.helpOk}</Text>
          </Pressable>
        </View>
      </Sheet>

      <Sheet open={dialog === "setup"} onClose={() => setDialog(null)} title={M.lineup} closeLabel={M.close}>
        <View style={styles.cornerGrid}>
          {(["TL", "TR", "BL", "BR"] as Corner[]).map((k) => {
            const s = st.order.find((x) => st.corner[x] === k);
            return (
              <View key={k} style={{ width: "48%" }}>
                <Pressable onPress={() => apply((d) => placeA1(d, k), false)} style={styles.corner}>
                  {s ? (
                    <>
                      <View style={[styles.dot, { backgroundColor: TEAM_FILL[teamOfSlot(s)] }]} />
                      <Text style={{ fontFamily: fonts.headBold, color: colors.cream }}>{s.toUpperCase()}</Text>
                      <Text numberOfLines={1} style={[styles.body, { fontSize: 13, flex: 1 }]}>
                        {nameOf(s)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.small}>—</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
        <Text style={styles.small}>{M.lineupHint}</Text>
        {!solo && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, 1].map((ti) => (
              <Pressable
                key={ti}
                onPress={() => setSlots((cur) => (ti === 0 ? { ...cur, a1: cur.a2, a2: cur.a1 } : { ...cur, b1: cur.b2, b2: cur.b1 }))}
                style={[styles.secondary, { flex: 1, height: 42 }]}
              >
                <Text style={[styles.body, { fontSize: 13, fontFamily: fonts.bodySemi }]}>{`⇄ ${ti === 0 ? "A1 / A2" : "B1 / B2"}`}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>

      <Sheet open={dialog === "pints"} onClose={() => setDialog(null)} title={M.pintsTitle} closeLabel={M.close}>
        <Text style={styles.small}>{M.pintsSub}</Text>
        {[0, 1].map((ti) => (
          <Pressable
            key={ti}
            onPress={() => {
              setWinner(ti);
              setDialog("end");
            }}
            style={styles.pintTeam}
          >
            <View style={[styles.dot, { width: 16, height: 16, borderRadius: 8, backgroundColor: TEAM_FILL[ti] }]} />
            <Text style={styles.pintTeamText}>{teamName(ti)}</Text>
          </Pressable>
        ))}
      </Sheet>

      <Sheet open={dialog === "end" && winner !== null} onClose={() => {}} closeLabel={M.close}>
        {winner !== null && (
          <>
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 40 }}>👑</Text>
              <Text style={[styles.kicker, { color: colors.gold }]}>{M.won}</Text>
              <Text style={[styles.pintTeamText, { fontSize: 36, textAlign: "center" }]}>{teamName(winner)}</Text>
              <Text style={styles.small}>{format(st.results.length === 1 ? M.roundsOne : M.roundsN, { n: st.results.length })}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[0, 1].map((ti) => (
                <View key={ti} style={[styles.endTeam, ti === winner && { borderColor: colors.gold }]}>
                  <Text numberOfLines={1} style={styles.small}>
                    {teamName(ti)}
                  </Text>
                  <Text style={styles.endN}>{totals[ti].sips}</Text>
                  <Text style={styles.small}>{M.sipsLabel}</Text>
                  {totals[ti].af > 0 && <Text style={[styles.small, { color: colors.redPale }]}>{`${totals[ti].af}× mama`}</Text>}
                </View>
              ))}
            </View>
            {awards.length > 0 && (
              <>
                <Text style={styles.kicker}>{M.highlights}</Text>
                {awards.map((a) => (
                  <View key={a.txt} style={styles.logRow}>
                    <Text style={{ width: 28, textAlign: "center", fontSize: 18 }}>{a.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.body}>{a.name}</Text>
                      <Text style={styles.small}>{a.txt}</Text>
                    </View>
                    <Text style={[styles.sips, { fontSize: 18 }]}>{`${a.n}×`}</Text>
                  </View>
                ))}
              </>
            )}
            <Pressable disabled={saving} onPress={() => onSave(toGameLog(st, slots, winner))} style={[styles.primary, saving && { opacity: 0.6 }]}>
              <Text style={styles.primaryText}>{saving ? M.saving : M.save}</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={() => {
                setWinner(null);
                setDialog(null);
              }}
              style={[styles.secondary, { height: 42 }]}
            >
              <Text style={styles.secondaryText}>{M.keepPlaying}</Text>
            </Pressable>
          </>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function Round({ children, onPress, label, gold }: { children: string; onPress: () => void; label: string; gold?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} style={[styles.roundBtn, gold && { backgroundColor: "rgba(255,182,39,0.15)", borderColor: "rgba(255,182,39,0.5)" }]}>
      <Text style={{ color: colors.cream, fontSize: 15, fontFamily: fonts.bodyBold }}>{children}</Text>
    </Pressable>
  );
}

/** Centered sheet over a dark backdrop (the web logger's dialogs). */
export function Sheet({ open, onClose, title, closeLabel, children }: { open: boolean; onClose: () => void; title?: string; closeLabel: string; children: React.ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {title ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} accessibilityLabel={closeLabel} style={styles.roundBtn}>
                <Text style={{ color: colors.cream }}>✕</Text>
              </Pressable>
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 12, gap: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 },
  round: { fontFamily: fonts.display, fontSize: 20, color: colors.cream, textTransform: "uppercase" },
  score: { height: 32, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 5 },
  scoreN: { fontFamily: fonts.display, fontSize: 18, color: colors.cream },
  af: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.redPale },
  dot: { width: 10, height: 10, borderRadius: 5 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  strip: { flexDirection: "row", gap: 6 },
  turn: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
  turnSlot: { fontFamily: fonts.display, fontSize: 13, color: colors.muted },
  turnName: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.cream, flexShrink: 1 },
  matArea: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 0 },
  dock: { borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 10, marginBottom: 4 },
  drinkTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.gold, textTransform: "uppercase", letterSpacing: 0.8 },
  redLine: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.redPale },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.cream },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  sips: { fontFamily: fonts.display, fontSize: 22, color: colors.gold },
  joker: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.raised, borderWidth: 1, borderColor: "rgba(255,182,39,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  primary: { height: 50, borderRadius: 14, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.display, fontSize: 19, letterSpacing: 1.1, color: colors.ink, textTransform: "uppercase" },
  secondary: { height: 50, borderRadius: 14, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondaryText: { fontFamily: fonts.headBold, fontSize: 16, letterSpacing: 0.6, color: colors.cream, textTransform: "uppercase" },
  slotTag: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  thrower: { fontFamily: fonts.display, fontSize: 28, color: colors.cream, textTransform: "uppercase", flexShrink: 1 },
  kicker: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.6, color: colors.muted, textTransform: "uppercase" },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 12 },
  sheet: { width: "100%", maxWidth: 440, borderRadius: 20, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 14 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, textTransform: "uppercase" },
  helpIcon: { width: 38, height: 28, borderRadius: 999, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  cornerGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6, padding: 8, borderRadius: radius.md, borderWidth: 3, borderColor: colors.gold, backgroundColor: "#0e1012" },
  corner: { height: 42, borderRadius: 10, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  pintTeam: { minHeight: 64, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  pintTeamText: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, textTransform: "uppercase", flexShrink: 1 },
  endTeam: { flex: 1, borderRadius: 12, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 2 },
  endN: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
});
