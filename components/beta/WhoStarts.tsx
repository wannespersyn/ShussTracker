/**
 * Beta "Wie begint?" step of the log wizard (Beta › A · Nieuwe game): pick
 * cap toss, Chwazi (fingers) or no preference, optionally followed by the
 * 3-2-1 Shuss countdown. When it's all done, onStarted gets a one-line
 * summary ("Gijs & Kekkinator begint") and the wizard moves on.
 */
"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { Duo } from "@/lib/teams";
import { CapToss } from "./CapToss";
import { Countdown } from "./Countdown";
import { FingerPicker } from "./FingerPicker";

type Opt = "toss" | "chwazi" | "none";
const GOLD = "#ffb627";

export function WhoStarts({
  teams,
  nameOf,
  onStarted,
  children,
}: Readonly<{
  teams: Duo[];
  nameOf: (id: string, fallback: string) => string;
  onStarted: (summary: string) => void;
  /** Extra settings shown above the start button (e.g. shot tracking). */
  children?: ReactNode;
}>) {
  const { t } = useT();
  const S = t.beta.start;
  const two = teams.length === 2;
  const opts: Opt[] = [...(two ? (["toss"] as Opt[]) : []), "chwazi", "none"];
  const [sel, setSel] = useState<Opt>(two ? "toss" : "chwazi");
  const [cd, setCd] = useState(true);
  const [open, setOpen] = useState<Opt | "count" | null>(null);
  const [pending, setPending] = useState("");

  const label = (d: Duo) => d.players.map((p) => nameOf(p.id, p.name)).join(" & ");
  const vsLabel = teams.map(label).join("  vs  ");

  function then(result: string) {
    if (cd) {
      setPending(result);
      setOpen("count");
      return;
    }
    setOpen(null);
    onStarted(result);
  }

  const finishCount = useCallback(() => {
    setOpen(null);
    onStarted(pending);
  }, [onStarted, pending]);

  function start() {
    if (sel === "none") then(S.noPrefDone);
    else setOpen(sel);
  }

  const meta: Record<Opt, { title: string; desc: string; cta: string; beta: boolean }> = {
    toss: { title: S.capToss, desc: S.optTossDesc, cta: S.toss, beta: true },
    chwazi: { title: "Chwazi", desc: S.optChwaziDesc, cta: S.optChwaziCta, beta: true },
    none: { title: S.noPref, desc: S.noPrefDesc, cta: S.startGame, beta: false },
  };

  const pill = (
    <span className="inline-flex items-center h-4.5 px-1.75 rounded-pill font-heading font-bold text-[10px] leading-none tracking-[0.08em]" style={{ backgroundColor: GOLD, color: "#111" }}>
      {t.beta.pill}
    </span>
  );

  return (
    <>
      <section className="flex flex-col gap-2" aria-labelledby="who-starts">
        <div id="who-starts" className="font-heading font-bold text-[12px] tracking-[0.14em] uppercase text-muted">
          {S.whoStarts}
        </div>
        <div role="radiogroup" aria-labelledby="who-starts" className="flex flex-col gap-2">
          {opts.map((o) => {
            const on = o === sel;
            const m = meta[o];
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSel(o)}
                className={cn("flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-surface-deep border-2 text-left text-cream", on ? "" : "border-transparent")}
                style={on ? { borderColor: GOLD } : undefined}
              >
                <span className="w-5.5 h-5.5 rounded-pill shrink-0 flex items-center justify-center border-2" style={{ borderColor: on ? GOLD : "#6e6e6a" }}>
                  <span className="w-2.5 h-2.5 rounded-pill" style={{ background: on ? GOLD : "transparent" }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 font-body font-bold text-[15px]">
                    {m.title}
                    {m.beta && pill}
                  </span>
                  <span className="block mt-0.5 font-body text-xs text-muted">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-1 flex items-center justify-between gap-3 px-3.5 py-3 rounded-[16px] bg-surface-deep text-cream">
          <span>
            <span className="flex items-center gap-2 font-body font-bold text-[15px]">
              {S.cdTitle}
              {pill}
            </span>
            <span className="block mt-0.5 font-body text-xs text-muted">{S.cdDesc}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={cd}
            aria-label={S.cdTitle}
            onClick={() => setCd((x) => !x)}
            className="relative w-13 h-8 rounded-pill shrink-0"
            style={{ background: cd ? GOLD : "#3a3a38" }}
          >
            <span className="absolute top-1 w-6 h-6 rounded-pill transition-[left]" style={{ left: cd ? 24 : 4, background: cd ? "#111" : "#fff" }} />
          </button>
        </div>
      </section>

      {children}

      <button type="button" onClick={start} className="mt-auto h-14.5 rounded-lg flex items-center justify-center gap-2.5 font-heading font-extrabold text-xl tracking-[0.05em] uppercase" style={{ backgroundColor: GOLD, color: "#111" }}>
        {meta[sel].cta}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      {open === "toss" && two && (
        <CapToss
          teamA={label(teams[0])}
          teamB={label(teams[1])}
          onClose={() => setOpen(null)}
          onDone={(side) => then(format(S.begins, { team: label(teams[side === "A" ? 0 : 1]) }))}
        />
      )}
      {open === "chwazi" && <FingerPicker onClose={() => setOpen(null)} doneLabel={cd ? S.startCountdown : S.startGame} onDone={() => then(S.chwaziDone)} />}
      {open === "count" && <Countdown label={vsLabel} onDone={finishCount} />}
    </>
  );
}
