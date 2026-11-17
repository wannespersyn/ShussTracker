/**
 * CrewRulesCard
 *
 * "Game & rules" on the manage-crew screen (owner): Leberschuss or BeerToss
 * (loads that game's defaults), the app colour and the house rules —
 * jokers, ad fundum after X empty rounds, shooting-box bonus, upside-down
 * caps ×2 and mama vs reset. Same choices as the website.
 *
 * Data: PATCH /api/v1/crews/{id} `{ rules }` through the `onSave` callback.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EMPTY_ROUND_CHOICES, GAMES, MAX_JOKERS, houseRules, rulesFor, sameRules, type GameKind, type Ruleset } from "@shared/rules";
import { format, useT } from "@/lib/i18n";
import { Button, Card, Kicker, Segmented, Toggle, Txt } from "@/components/ui";
import { colors, fonts } from "@/theme";

export function CrewRulesCard({ initial, onSave }: { initial: Ruleset; onSave: (rules: Ruleset) => Promise<boolean> }) {
  const { t } = useT();
  const R = t.rules;
  const [rules, setRules] = useState<Ruleset>(initial);
  const [saved, setSaved] = useState<Ruleset>(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = !sameRules(rules, saved);
  const custom = houseRules(rules).filter((k) => k !== "theme").length;
  const gameName = (g: GameKind) => (g === "beertoss" ? R.beertoss : R.leberschuss);
  const set = <K extends keyof Ruleset>(k: K, v: Ruleset[K]) => setRules((r) => ({ ...r, [k]: v }));

  async function save() {
    setBusy(true);
    setFailed(false);
    const ok = await onSave(rules);
    setBusy(false);
    if (ok) setSaved(rules);
    else setFailed(true);
  }

  return (
    <Card style={{ gap: 12 }}>
      <Kicker>{R.title}</Kicker>
      <Txt style={styles.sub}>{R.sub}</Txt>

      <Txt v="bodySemi">{R.game}</Txt>
      <Segmented
        value={rules.game}
        options={GAMES.map((g) => ({ id: g, label: gameName(g) }))}
        onChange={(g) => setRules({ ...rulesFor(g), theme: g })}
      />
      <Txt v="bodySemi">{R.theme}</Txt>
      <Segmented
        value={rules.theme}
        options={[
          { id: "leberschuss" as const, label: R.themeLeberschuss },
          { id: "beertoss" as const, label: R.themeBeertoss },
        ]}
        onChange={(v) => set("theme", v)}
      />

      <View style={styles.headRow}>
        <Kicker>{R.houseRules}</Kicker>
        {custom > 0 && (
          <Pressable onPress={() => setRules({ ...rulesFor(rules.game), theme: rules.theme })} hitSlop={8}>
            <Txt style={styles.link}>{format(R.reset, { game: gameName(rules.game) })}</Txt>
          </Pressable>
        )}
      </View>

      <Txt v="bodySemi">{R.jokers}</Txt>
      <Segmented
        value={String(rules.jokers)}
        options={Array.from({ length: MAX_JOKERS + 1 }, (_, n) => ({ id: String(n), label: n === 0 ? R.jokersOff : String(n) }))}
        onChange={(v) => set("jokers", Number(v))}
      />
      <Txt v="bodySemi">{R.adFundum}</Txt>
      <Segmented
        value={rules.emptyRoundsForAll === null ? "off" : String(rules.emptyRoundsForAll)}
        options={[{ id: "off", label: R.adFundumOff }, ...EMPTY_ROUND_CHOICES.map((n) => ({ id: String(n), label: String(n) }))]}
        onChange={(v) => set("emptyRoundsForAll", v === "off" ? null : Number(v))}
      />
      <SwitchRow label={R.bonus} sub={R.bonusSub} on={rules.shootingBoxBonus} onToggle={() => set("shootingBoxBonus", !rules.shootingBoxBonus)} />
      <SwitchRow label={R.flip} sub={R.flipSub} on={rules.upsideDownDoubles} onToggle={() => set("upsideDownDoubles", !rules.upsideDownDoubles)} />
      <Txt v="bodySemi">{R.center}</Txt>
      <Segmented
        value={rules.centerZone}
        options={[
          { id: "mama" as const, label: R.centerMama },
          { id: "reset" as const, label: R.centerReset },
        ]}
        onChange={(v) => set("centerZone", v)}
      />

      <Button label={busy ? t.mat.saving : dirty ? R.save : R.saved} disabled={!dirty || busy} onPress={() => void save()} />
      {failed && <Txt style={styles.error}>{R.saveFailed}</Txt>}
    </Card>
  );
}

function SwitchRow({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: on }} style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="bodySemi">{label}</Txt>
        <Txt style={styles.sub}>{sub}</Txt>
      </View>
      <Toggle on={on} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sub: { color: colors.muted, fontSize: 13 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  link: { color: colors.muted, fontSize: 12, fontFamily: fonts.bodySemi, textDecorationLine: "underline" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  error: { color: colors.redPale, fontSize: 12 },
});
