/**
 * Stats — Route: /stats
 *
 * The player-built stats page, like the website: swipeable screens of
 * blocks, one crew / player / period filter for all of them (session, 7 or
 * 30 days, season, ever, or a custom range), and an edit mode to rename
 * screens, reorder blocks, change their size (S/M/L), remove them, add
 * blocks from the library and add new screens from a template. The layout
 * is saved per player.
 *
 * Data: GET /api/v1/stats, GET/PUT /api/v1/me/stats-layout
 * Notes: numbers from the website's lib/stats-scope.ts, blocks in
 * components/stats/StatsBlocks.tsx, layout rules in lib/stats-layout.ts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import type { StatsExplorerData } from "@/lib/db/stats";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import {
  BLOCK_KINDS,
  BLOCKS,
  MAX_BLOCKS,
  MAX_SCREEN_NAME,
  MAX_SCREENS,
  TEMPLATES,
  blocksFrom,
  defaultLayout,
  newId,
  type StatsBlock,
  type StatsBlockCategory,
  type StatsBlockKind,
  type StatsBlockSize,
  type StatsLayout,
  type StatsTemplate,
} from "@shared/stats-layout";
import { DAY, buildScope, mineOf, periodRange, sessionsOf, type Period } from "@shared/stats-scope";
import { StatsBlockView, blockTitle, type BlockCtx } from "@/components/stats/StatsBlocks";
import { Button, CenterState, ErrorState } from "@/components/ui";
import { colors, fonts } from "@/theme";

const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const dayInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function StatsScreen() {
  const { t } = useT();
  const q = useQuery<StatsExplorerData>("/stats");
  const lq = useQuery<{ layout: StatsLayout | null }>("/me/stats-layout");
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data || (!lq.data && !lq.error)) return <CenterState />;
  if (q.data.crews.length === 0) return <CenterState title={t.more.noCrew} body={t.empty.statsNoCrew} />;
  if (q.data.games.length === 0) return <CenterState title={t.empty.statsNoGames} body={t.empty.statsNoGamesBody} />;
  return <StatsPage data={q.data} initialLayout={lq.data?.layout ?? null} />;
}

function StatsPage({ data, initialLayout }: { data: StatsExplorerData; initialLayout: StatsLayout | null }) {
  const { t, locale } = useT();
  const sb = t.sb;
  const { me } = useAuth();
  const { crew: activeCrew, setCrewId: rememberCrew } = useCrew();
  const currentUserId = me?.user.id ?? "";
  const { width } = useWindowDimensions();
  const [now] = useState(() => Date.now());

  const defaultCrew = useMemo(() => {
    if (activeCrew && data.crews.some((c) => c.id === activeCrew.id)) return activeCrew.id;
    const count = new Map<string, number>();
    for (const g of data.games) if (g.crewId && g.teams.some((x) => x.userIds.includes(currentUserId))) count.set(g.crewId, (count.get(g.crewId) ?? 0) + 1);
    return [...data.crews].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0]?.id ?? "";
  }, [data, currentUserId, activeCrew]);
  const [crewId, setCrewId] = useState(defaultCrew);
  const [playerId, setPlayerId] = useState(currentUserId);
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(() => dayInput(now - 30 * DAY));
  const [to, setTo] = useState(() => dayInput(now));
  const [picker, setPicker] = useState<null | "crew" | "player" | "period">(null);

  const nameOf = useMemo(() => new Map(data.people.map((p) => [p.id, first(p.name)])), [data.people]);
  const crew = data.crews.find((c) => c.id === crewId);
  const loc = locale === "nl" ? "nl-BE" : "en-GB";
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" }), [loc]);
  const dateTimeFmt = useMemo(() => new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [loc]);
  const scope = useMemo(() => {
    const crewGames = data.games.filter((g) => g.crewId === crewId);
    const last = sessionsOf(mineOf(crewGames, playerId).map((x) => x.g))[0];
    const range = periodRange(period, now, { lastSessionStart: last ? new Date(last[0].playedAt).getTime() : undefined, from, to });
    return buildScope(data, crewId, playerId, range);
  }, [data, crewId, playerId, period, now, from, to]);
  const people = useMemo(
    () =>
      [...new Set([currentUserId, ...scope.people])].sort((a, b) =>
        a === currentUserId ? -1 : b === currentUserId ? 1 : (nameOf.get(a) ?? "").localeCompare(nameOf.get(b) ?? ""),
      ),
    [scope.people, currentUserId, nameOf],
  );
  const ctx: BlockCtx = {
    sb,
    name: (id) => nameOf.get(id) ?? t.more.player,
    playerId,
    isMe: playerId === currentUserId,
    crewName: crew?.name ?? "",
    date: (iso) => dateFmt.format(new Date(iso)),
    dateTime: (iso) => dateTimeFmt.format(new Date(iso)),
  };

  // ---- Layout ----
  const [layout, setLayout] = useState<StatsLayout>(() => initialLayout ?? defaultLayout({ overview: sb.defOverview, mama: sb.defMama, duos: sb.defDuos }));
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [library, setLibrary] = useState(false);
  const [creating, setCreating] = useState(false);
  const pager = useRef<ScrollViewInstance>(null);
  const screen = layout.screens[Math.min(index, layout.screens.length - 1)];
  const pageW = width;

  const persist = (next: StatsLayout) => {
    setLayout(next);
    void api("/me/stats-layout", { method: "PUT", body: { layout: next } }).catch(() => {});
  };
  const updateScreen = (fn: (blocks: StatsBlock[]) => StatsBlock[], name?: string) =>
    setLayout((l) => ({ ...l, screens: l.screens.map((x) => (x.id === screen.id ? { ...x, blocks: fn(x.blocks), name: name ?? x.name } : x)) }));

  function goTo(i: number) {
    setIndex(i);
    pager.current?.scrollTo({ x: i * pageW, animated: true });
  }
  useEffect(() => {
    if (!editing) setTimeout(() => pager.current?.scrollTo({ x: index * pageW, animated: false }), 0);
    // Only when coming back from edit mode or when screens are added/removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, layout.screens.length]);
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW));
    if (i !== index) setIndex(i);
  }

  function removeScreen(id: string) {
    const sc = layout.screens.find((x) => x.id === id);
    if (!sc || layout.screens.length <= 1) return;
    Alert.alert(format(sb.removeScreenConfirm, { name: sc.name || sb.newScreen }), undefined, [
      { text: t.game.cancel, style: "cancel" },
      {
        text: format(sb.removeScreen, { name: sc.name }),
        style: "destructive",
        onPress: () => {
          const next = { ...layout, screens: layout.screens.filter((x) => x.id !== id) };
          setIndex((i) => Math.min(i, next.screens.length - 1));
          persist(next);
        },
      },
    ]);
  }
  function createScreen(name: string, tpl: StatsTemplate) {
    if (layout.screens.length >= MAX_SCREENS) return;
    const next = { ...layout, screens: [...layout.screens, { id: newId("s"), name: name.trim().slice(0, MAX_SCREEN_NAME) || sb.newScreen, blocks: blocksFrom(tpl) }] };
    persist(next);
    setCreating(false);
    setEditing(false);
    setIndex(next.screens.length - 1);
  }
  function addBlock(kind: StatsBlockKind) {
    if (screen.blocks.length >= MAX_BLOCKS) return;
    updateScreen((b) => [...b, { id: newId("b"), kind, size: BLOCKS[kind].sizes[0] }]);
    setLibrary(false);
  }
  function moveBlock(id: string, d: -1 | 1) {
    updateScreen((blocks) => {
      const i = blocks.findIndex((b) => b.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= blocks.length) return blocks;
      const next = [...blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const periods: [Period, string][] = [
    ["session", sb.pSession],
    ["7d", sb.p7],
    ["30d", sb.p30],
    ["season", sb.pSeason],
    ["ever", sb.pEver],
    ["custom", sb.pCustom],
  ];

  if (editing) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.gold }]}>{sb.editing}</Text>
            <TextInput value={screen.name} maxLength={MAX_SCREEN_NAME} onChangeText={(v) => updateScreen((b) => b, v)} accessibilityLabel={sb.screenName} style={styles.nameInput} />
          </View>
          <Pressable
            onPress={() => {
              setEditing(false);
              persist(layout);
            }}
            style={styles.done}
          >
            <Text style={styles.doneText}>{sb.done}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }} style={{ flexGrow: 0 }}>
          {layout.screens.map((sc, i) => (
            <View key={sc.id} style={[styles.tab, { paddingRight: 4 }, i === index && styles.tabOn]}>
              <Pressable onPress={() => setIndex(i)}>
                <Text style={[styles.tabText, i === index && { color: colors.ink }]}>{sc.name || sb.newScreen}</Text>
              </Pressable>
              {layout.screens.length > 1 && (
                <Pressable onPress={() => removeScreen(sc.id)} accessibilityLabel={format(sb.removeScreen, { name: sc.name })} hitSlop={6} style={{ paddingHorizontal: 6 }}>
                  <Text style={{ color: i === index ? colors.ink : colors.muted, fontSize: 12 }}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
          {layout.screens.length < MAX_SCREENS && (
            <Pressable onPress={() => setCreating(true)} style={[styles.tab, styles.dashedGold]}>
              <Text style={[styles.tabText, { color: colors.gold }]}>{`+ ${sb.addScreen}`}</Text>
            </Pressable>
          )}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}>
          <View style={styles.grid}>
            {screen.blocks.map((b, i) => {
              const title = blockTitle(sb, b.kind);
              return (
                <View key={b.id} style={[b.size === "S" ? { width: "48.5%" } : { width: "100%" }, styles.editBlock]}>
                  <View pointerEvents="none" style={{ opacity: 0.45 }}>
                    <StatsBlockView block={{ ...b, size: "M" }} s={scope} ctx={ctx} />
                  </View>
                  <View style={styles.editBar}>
                    <Pressable onPress={() => moveBlock(b.id, -1)} disabled={i === 0} style={[styles.editBtn, i === 0 && { opacity: 0.3 }]} accessibilityLabel={`${title} ↑`}>
                      <Text style={styles.editBtnText}>‹</Text>
                    </Pressable>
                    <Pressable onPress={() => moveBlock(b.id, 1)} disabled={i === screen.blocks.length - 1} style={[styles.editBtn, i === screen.blocks.length - 1 && { opacity: 0.3 }]} accessibilityLabel={`${title} ↓`}>
                      <Text style={styles.editBtnText}>›</Text>
                    </Pressable>
                    <Text numberOfLines={1} style={[styles.kicker, { flex: 1, color: colors.soft }]}>
                      {title}
                    </Text>
                    <Pressable onPress={() => updateScreen((list) => list.filter((x) => x.id !== b.id))} accessibilityLabel={format(sb.removeBlock, { name: title })} style={styles.remove}>
                      <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold }}>−</Text>
                    </Pressable>
                  </View>
                  {BLOCKS[b.kind].sizes.length > 1 && (
                    <View style={styles.sizes}>
                      {(["S", "M", "L"] as StatsBlockSize[])
                        .filter((k) => BLOCKS[b.kind].sizes.includes(k))
                        .map((k) => (
                          <Pressable key={k} onPress={() => updateScreen((list) => list.map((x) => (x.id === b.id ? { ...x, size: k } : x)))} style={[styles.size, b.size === k && { backgroundColor: colors.gold }]}>
                            <Text style={[styles.sizeText, b.size === k && { color: colors.ink }]}>{k}</Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>
              );
            })}
            {screen.blocks.length === 0 && <Text style={[styles.small, { width: "100%", textAlign: "center", paddingVertical: 40 }]}>{sb.emptyScreen}</Text>}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable onPress={() => setLibrary(true)} disabled={screen.blocks.length >= MAX_BLOCKS} style={[styles.addBlock, screen.blocks.length >= MAX_BLOCKS && { opacity: 0.4 }]}>
            <Text style={[styles.doneText, { color: colors.gold }]}>{`+ ${sb.addBlock}`}</Text>
          </Pressable>
        </View>
        <BlockLibrary open={library} onScreen={new Set(screen.blocks.map((b) => b.kind))} onAdd={addBlock} onClose={() => setLibrary(false)} />
        <NewScreenSheet open={creating} n={layout.screens.length + 1} onCreate={createScreen} onClose={() => setCreating(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.round} accessibilityLabel={t.common.back}>
            <Text style={{ color: colors.cream, fontSize: 20 }}>‹</Text>
          </Pressable>
          <Text style={styles.title}>{sb.title}</Text>
          {data.crews.length > 1 ? (
            <Pressable onPress={() => setPicker("crew")} style={styles.select}>
              <Text numberOfLines={1} style={styles.selectText}>{`${crew?.name ?? ""} ▾`}</Text>
            </Pressable>
          ) : (
            <Text numberOfLines={1} style={[styles.small, { maxWidth: 120 }]}>
              {crew?.name}
            </Text>
          )}
          <Pressable onPress={() => setEditing(true)} style={styles.round} accessibilityLabel={sb.edit}>
            <Text style={{ color: colors.cream, fontSize: 15 }}>✎</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {layout.screens.map((sc, i) => (
            <Pressable key={sc.id} onPress={() => goTo(i)} style={[styles.tab, i === index && styles.tabOn]}>
              <Text style={[styles.tabText, i === index && { color: colors.ink }]}>{sc.name || sb.newScreen}</Text>
            </Pressable>
          ))}
          {layout.screens.length < MAX_SCREENS && (
            <Pressable
              onPress={() => {
                setEditing(true);
                setCreating(true);
              }}
              accessibilityLabel={sb.newScreen}
              style={[styles.tab, { borderStyle: "dashed" }]}
            >
              <Text style={styles.tabText}>+</Text>
            </Pressable>
          )}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => setPicker("player")} style={styles.select}>
            <Text style={styles.selectText}>{`${playerId === currentUserId ? sb.me : ctx.name(playerId)} ▾`}</Text>
          </Pressable>
          <Pressable onPress={() => setPicker("period")} style={styles.select}>
            <Text style={styles.selectText}>{`${periods.find((p) => p[0] === period)?.[1]} ▾`}</Text>
          </Pressable>
        </View>
        {period === "custom" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput value={from} onChangeText={setFrom} accessibilityLabel={sb.from} placeholder="YYYY-MM-DD" placeholderTextColor={colors.dim} style={styles.date} />
            <Text style={styles.small}>→</Text>
            <TextInput value={to} onChangeText={setTo} accessibilityLabel={sb.to} placeholder="YYYY-MM-DD" placeholderTextColor={colors.dim} style={styles.date} />
          </View>
        )}
      </View>
      <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1, marginTop: 12 }}>
        {layout.screens.map((sc) => (
          <ScrollView key={sc.id} style={{ width: pageW }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            <View style={styles.grid}>
              {sc.blocks.map((b) => (
                <StatsBlockView key={b.id} block={b} s={scope} ctx={ctx} />
              ))}
              {sc.blocks.length === 0 && (
                <Pressable
                  onPress={() => {
                    setEditing(true);
                    setLibrary(true);
                  }}
                  style={styles.emptyCta}
                >
                  <Text style={[styles.doneText, { color: colors.gold }]}>{`+ ${sb.emptyCta}`}</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        ))}
      </ScrollView>
      {layout.screens.length > 1 && (
        <View style={styles.dots} accessibilityLabel={format(sb.screenOf, { n: index + 1, t: layout.screens.length })}>
          {layout.screens.map((sc, i) => (
            <Pressable key={sc.id} onPress={() => goTo(i)} hitSlop={6} style={[styles.dot, i === index && { width: 20, backgroundColor: colors.gold }]} />
          ))}
        </View>
      )}

      <Picker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === "crew" ? sb.crew : picker === "player" ? sb.player : sb.period}
        options={
          picker === "crew"
            ? data.crews.map((c) => ({ id: c.id, label: c.name }))
            : picker === "player"
              ? people.map((id) => ({ id, label: id === currentUserId ? sb.me : ctx.name(id) }))
              : periods.map(([id, label]) => ({ id, label }))
        }
        value={picker === "crew" ? crewId : picker === "player" ? playerId : period}
        onPick={(id) => {
          if (picker === "crew") {
            setCrewId(id);
            rememberCrew(id);
          } else if (picker === "player") setPlayerId(id);
          else setPeriod(id as Period);
          setPicker(null);
        }}
      />
    </SafeAreaView>
  );
}

function Picker({ open, onClose, title, options, value, onPick }: { open: boolean; onClose: () => void; title: string; options: { id: string; label: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((o) => (
              <Pressable key={o.id} onPress={() => onPick(o.id)} style={styles.option}>
                <Text style={[styles.optionText, o.id === value && { color: colors.gold }]}>{o.label}</Text>
                {o.id === value && <Text style={{ color: colors.gold }}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CAT_ICON: Record<StatsBlockCategory, string> = { elo: "📈", mama: "🔴", duo: "👥", crew: "🏆", nights: "🌙" };

function BlockLibrary({ open, onScreen, onAdd, onClose }: { open: boolean; onScreen: Set<StatsBlockKind>; onAdd: (k: StatsBlockKind) => void; onClose: () => void }) {
  const { t } = useT();
  const sb = t.sb;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StatsBlockCategory | "all">("all");
  const cats: [StatsBlockCategory | "all", string][] = [
    ["all", sb.catAll],
    ["elo", sb.catElo],
    ["mama", sb.catMama],
    ["duo", sb.catDuo],
    ["crew", sb.catCrew],
    ["nights", sb.catNights],
  ];
  const list = BLOCK_KINDS.filter((k) => cat === "all" || BLOCKS[k].cat === cat).filter((k) => {
    const needle = q.trim().toLowerCase();
    return !needle || `${sb.b[k]} ${sb.b[`${k}D` as keyof typeof sb.b]}`.toLowerCase().includes(needle);
  });
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { padding: 20, gap: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.title}>{sb.library}</Text>
          <Pressable onPress={onClose} style={styles.round} accessibilityLabel={sb.close}>
            <Text style={{ color: colors.cream }}>✕</Text>
          </Pressable>
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder={sb.search} placeholderTextColor={colors.dim} style={styles.search} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
          {cats.map(([id, label]) => (
            <Pressable key={id} onPress={() => setCat(id)} style={[styles.tab, cat === id && styles.tabOn]}>
              <Text style={[styles.tabText, { fontSize: 14 }, cat === id && { color: colors.ink }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: 30 }]}>
          {list.map((k) => {
            const def = BLOCKS[k];
            const added = onScreen.has(k);
            return (
              <View key={k} style={styles.libCard}>
                <View style={styles.libIcon}>
                  <Text style={{ fontSize: 22 }}>{CAT_ICON[def.cat]}</Text>
                  {def.pro && <Text style={styles.pro}>{sb.pro}</Text>}
                </View>
                <Text style={[styles.optionText, { fontFamily: fonts.display, textTransform: "uppercase" }]}>{sb.b[k]}</Text>
                <Text style={[styles.small, { minHeight: 32 }]}>{sb.b[`${k}D` as keyof typeof sb.b]}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[styles.kicker, { fontSize: 11 }]}>{[...def.sizes].sort().join(" · ")}</Text>
                  <Pressable onPress={() => onAdd(k)} style={[styles.add, added && { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.lineStrong }]}>
                    <Text style={[styles.sizeText, { color: added ? colors.muted : colors.ink }]}>{added ? sb.onScreen : sb.add}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function NewScreenSheet({ open, n, onCreate, onClose }: { open: boolean; n: number; onCreate: (name: string, tpl: StatsTemplate) => void; onClose: () => void }) {
  const { t } = useT();
  const sb = t.sb;
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState<StatsTemplate>("empty");
  const options: [StatsTemplate, string, string][] = [
    ["empty", sb.tEmpty, sb.tEmptyD],
    ["overview", sb.tOverview, sb.tOverviewD],
    ["mama", sb.tMama, sb.tMamaD],
    ["duos", sb.tDuos, sb.tDuosD],
    ["rivals", sb.tRivals, sb.tRivalsD],
    ["nights", sb.tNights, sb.tNightsD],
  ];
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={onClose} style={styles.round} accessibilityLabel={sb.close}>
            <Text style={{ color: colors.cream }}>✕</Text>
          </Pressable>
          <View>
            <Text style={styles.kicker}>{format(sb.newKicker, { n })}</Text>
            <Text style={styles.title}>{sb.newTitle}</Text>
          </View>
        </View>
        <Text style={styles.kicker}>{sb.name}</Text>
        <TextInput value={name} onChangeText={setName} maxLength={MAX_SCREEN_NAME} placeholder={options.find((o) => o[0] === tpl)?.[1]} placeholderTextColor={colors.dim} style={[styles.search, { fontFamily: fonts.display, fontSize: 22 }]} />
        <Text style={styles.kicker}>{sb.startFrom}</Text>
        {options.map(([id, label, desc]) => {
          const on = tpl === id;
          return (
            <Pressable key={id} onPress={() => setTpl(id)} style={[styles.tpl, on && { borderColor: colors.gold, backgroundColor: "rgba(255,182,39,0.1)" }]}>
              <View style={{ width: 64, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {TEMPLATES[id].length === 0 ? (
                  <View style={{ width: 64, height: 46, borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#3a4245" }} />
                ) : (
                  TEMPLATES[id].slice(0, 5).map(([, size], i) => (
                    <View key={i} style={{ width: size === "S" ? 30 : 64, height: size === "L" ? 24 : size === "M" ? 16 : 18, borderRadius: 4, backgroundColor: on ? colors.gold : colors.chip }} />
                  ))
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.optionText, { fontFamily: fonts.display, fontSize: 20, textTransform: "uppercase" }]}>{label}</Text>
                <Text style={styles.small}>{desc}</Text>
              </View>
            </Pressable>
          );
        })}
        <Text style={styles.small}>{sb.newNote}</Text>
        <Button label={sb.create} onPress={() => onCreate(name || (options.find((o) => o[0] === tpl)?.[1] ?? ""), tpl)} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 28, color: colors.cream, letterSpacing: 0.8 },
  kicker: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.6, color: colors.muted, textTransform: "uppercase" },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
  select: { height: 36, maxWidth: 160, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, justifyContent: "center" },
  selectText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.cream },
  date: { flex: 1, height: 40, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, color: colors.cream, fontFamily: fonts.body },
  tab: { height: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center" },
  tabOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 0.9, color: colors.muted, textTransform: "uppercase" },
  dashedGold: { borderStyle: "dashed", borderColor: "rgba(255,182,39,0.5)", backgroundColor: "transparent" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#3a4245" },
  emptyCta: { width: "100%", height: 160, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,182,39,0.5)", alignItems: "center", justifyContent: "center" },
  nameInput: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, textTransform: "uppercase", borderBottomWidth: 2, borderStyle: "dashed", borderBottomColor: "rgba(255,182,39,0.5)", paddingVertical: 2 },
  done: { height: 42, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.gold, justifyContent: "center" },
  doneText: { fontFamily: fonts.headBold, fontSize: 17, letterSpacing: 1.2, color: colors.ink },
  editBlock: { borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(243,241,234,0.22)", overflow: "hidden" },
  editBar: { position: "absolute", left: 8, right: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  editBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  editBtnText: { color: colors.cream, fontSize: 20, fontFamily: fonts.bodyBold },
  remove: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" },
  sizes: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", gap: 2, padding: 3, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  size: { width: 32, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  sizeText: { fontFamily: fonts.headBold, fontSize: 13, color: colors.muted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 34, backgroundColor: colors.surface },
  addBlock: { height: 56, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,182,39,0.6)", backgroundColor: colors.deep, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.deep, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 10 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.cream, textTransform: "uppercase" },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.cream },
  search: { height: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.lineStrong, color: colors.cream, fontFamily: fonts.body, fontSize: 15 },
  libCard: { width: "48.5%", gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  libIcon: { height: 60, borderRadius: 10, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  pro: { position: "absolute", top: 6, right: 6, fontFamily: fonts.headBold, fontSize: 10, letterSpacing: 1, color: colors.ink, backgroundColor: colors.gold, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: "hidden" },
  add: { height: 32, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.gold, justifyContent: "center" },
  tpl: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.deep },
});
