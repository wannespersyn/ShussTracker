/**
 * CrewRulesForm
 *
 * "Game & rules" on the manage-crew screen: pick Leberschuss or BeerToss
 * (which loads that game's defaults), the app colour, and the house rules
 * (jokers, ad fundum after X empty rounds, shooting-box bonus, upside-down
 * caps ×2, mama vs reset).
 *
 * Data: saves through setCrewRulesAction (owner only, validated server-side).
 */
"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { EMPTY_ROUND_CHOICES, GAMES, MAX_JOKERS, houseRules, rulesFor, sameRules, type GameKind, type Ruleset } from "@/lib/rules";
import { setCrewRulesAction } from "@/app/(app)/crews/[crewId]/manage/actions";

export function CrewRulesForm({ crewId, initial }: Readonly<{ crewId: string; initial: Ruleset }>) {
  const { t } = useT();
  const R = t.rules;
  const [rules, setRules] = useState<Ruleset>(initial);
  const [saved, setSaved] = useState<Ruleset>(initial);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = !sameRules(rules, saved);
  const custom = houseRules(rules).filter((k) => k !== "theme").length;
  const gameName = (g: GameKind) => (g === "beertoss" ? R.beertoss : R.leberschuss);
  const set = <K extends keyof Ruleset>(k: K, v: Ruleset[K]) => setRules((r) => ({ ...r, [k]: v }));

  function save() {
    setError(false);
    startTransition(async () => {
      try {
        await setCrewRulesAction(crewId, rules);
        setSaved(rules);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <section aria-labelledby="crew-rules" className="flex flex-col gap-3 p-3.5 rounded-[18px] bg-surface-deep border border-line">
      <div className="flex flex-col gap-1">
        <h2 id="crew-rules" className="font-heading font-bold text-[13px] tracking-[0.12em] uppercase text-muted">
          {R.title}
        </h2>
        <p className="font-body text-[13px] text-soft leading-snug">{R.sub}</p>
      </div>

      <Segmented
        label={R.game}
        value={rules.game}
        options={GAMES.map((g) => ({ value: g, label: gameName(g) }))}
        onChange={(g) => setRules({ ...rulesFor(g), theme: g })}
      />
      <Segmented
        label={R.theme}
        value={rules.theme}
        options={[
          { value: "leberschuss", label: R.themeLeberschuss },
          { value: "beertoss", label: R.themeBeertoss },
        ]}
        onChange={(v) => set("theme", v)}
      />

      <div className="flex items-center justify-between pt-1">
        <span className="font-heading font-bold text-[12px] tracking-[0.12em] uppercase text-muted">{R.houseRules}</span>
        {custom > 0 && (
          <button type="button" onClick={() => setRules({ ...rulesFor(rules.game), theme: rules.theme })} className="font-body font-semibold text-xs text-muted underline underline-offset-2">
            {format(R.reset, { game: gameName(rules.game) })}
          </button>
        )}
      </div>

      <Row label={R.jokers}>
        <select
          aria-label={R.jokers}
          value={rules.jokers}
          onChange={(e) => set("jokers", Number(e.target.value))}
          className="h-9 px-2 rounded-sm bg-surface-panel border border-line-strong font-body font-semibold text-sm text-cream"
        >
          {Array.from({ length: MAX_JOKERS + 1 }, (_, n) => (
            <option key={n} value={n}>
              {n === 0 ? R.jokersOff : n}
            </option>
          ))}
        </select>
      </Row>
      <Row label={R.adFundum}>
        <select
          aria-label={R.adFundum}
          value={rules.emptyRoundsForAll ?? "off"}
          onChange={(e) => set("emptyRoundsForAll", e.target.value === "off" ? null : Number(e.target.value))}
          className="h-9 px-2 rounded-sm bg-surface-panel border border-line-strong font-body font-semibold text-sm text-cream"
        >
          <option value="off">{R.adFundumOff}</option>
          {EMPTY_ROUND_CHOICES.map((n) => (
            <option key={n} value={n}>
              {format(R.adFundumN, { n })}
            </option>
          ))}
        </select>
      </Row>
      <Toggle label={R.bonus} sub={R.bonusSub} checked={rules.shootingBoxBonus} onChange={(v) => set("shootingBoxBonus", v)} />
      <Toggle label={R.flip} sub={R.flipSub} checked={rules.upsideDownDoubles} onChange={(v) => set("upsideDownDoubles", v)} />
      <Segmented
        label={R.center}
        value={rules.centerZone}
        options={[
          { value: "mama", label: R.centerMama },
          { value: "reset", label: R.centerReset },
        ]}
        onChange={(v) => set("centerZone", v)}
      />

      <button
        type="button"
        onClick={save}
        disabled={!dirty || pending}
        className="h-11 rounded-md bg-amber text-ink font-body font-bold text-sm disabled:opacity-50"
      >
        {pending ? t.mat.saving : dirty ? R.save : R.saved}
      </button>
      {error && (
        <p role="alert" className="font-body text-xs text-red-pale">
          {R.saveFailed}
        </p>
      )}
    </section>
  );
}

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-body font-semibold text-[14px]">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: Readonly<{ label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }>) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer">
      <span className="flex flex-col gap-0.5">
        <span className="font-body font-semibold text-[14px]">{label}</span>
        <span className="font-body text-xs text-muted leading-snug">{sub}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-5 h-5 accent-(--color-gold) shrink-0" />
    </label>
  );
}

function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
}: Readonly<{ label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-body font-semibold text-[14px] mb-1.5">{label}</legend>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-10 px-2 py-1.5 rounded-sm border font-body font-semibold text-[13px] leading-tight",
              o.value === value ? "bg-amber text-ink border-transparent" : "bg-surface-panel border-line-strong text-cream",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
