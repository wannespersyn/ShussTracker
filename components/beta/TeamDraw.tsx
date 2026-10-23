/**
 * Beta teams draw (Animaties › Teams loten): the players' chips shuffle
 * around, the dice spins, then the chips fly into the Team A (gold) and
 * Team B (red) panels and VS slams in. Two teams only (1v1 or 2v2); the
 * caller decides the teams and passes them in.
 */
"use client";

import type { CSSProperties } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { D, Stage } from "./Stage";
import a from "./start.module.css";

const SLOTS4 = [
  [300, 440, 370, 510, 300, 440],
  [370, 300, 510, 440, 370, 300],
  [440, 510, 300, 370, 510, 370],
  [510, 370, 440, 300, 440, 510],
];
const SLOTS2 = [
  [370, 440, 370, 440, 370, 440],
  [440, 370, 440, 370, 440, 370],
];
const WOBBLE = [
  [-14, 10, -8, 12],
  [12, -10, 8, -12],
  [-10, 14, -12, 8],
  [10, -14, 12, -8],
];

export function TeamDraw({
  teamA,
  teamB,
  sub,
  onAgain,
  onDone,
  doneLabel,
  onClose,
}: Readonly<{
  teamA: string[];
  teamB: string[];
  /** Footer line, e.g. "Willekeurig verdeeld". */
  sub: string;
  onAgain: () => void;
  onDone: () => void;
  doneLabel: string;
  onClose: () => void;
}>) {
  const { t } = useT();
  const S = t.beta.start;
  const solo = teamA.length === 1 && teamB.length === 1;
  const finalY = solo ? { A: [219], B: [595] } : { A: [196, 258], B: [572, 634] };
  // Interleave so chips start mixed up: A0, B0, A1, B1.
  const chips = solo
    ? [
        { name: teamA[0], team: "A" as const, slot: 0 },
        { name: teamB[0], team: "B" as const, slot: 0 },
      ]
    : [
        { name: teamA[0], team: "A" as const, slot: 0 },
        { name: teamB[0], team: "B" as const, slot: 0 },
        { name: teamA[1], team: "A" as const, slot: 1 },
        { name: teamB[1], team: "B" as const, slot: 1 },
      ];

  return (
    <Stage bg="#0E0E0F" role="dialog" aria-modal="true" aria-label={S.optTeams}>
      <button type="button" onClick={onClose} aria-label={S.close} style={{ position: "absolute", right: 10, top: 46, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", zIndex: 3 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div style={{ position: "absolute", left: 20, right: 60, top: 44, display: "flex", alignItems: "center", gap: 14 }}>
        <div className={a.tmDice} style={{ width: 48, height: 48, borderRadius: 12, background: "#FFFFFF", position: "relative", flexShrink: 0 }} aria-hidden="true">
          {[
            { left: 10, top: 10 },
            { right: 10, top: 10 },
            { left: 20, top: 20 },
            { left: 10, bottom: 10 },
            { right: 10, bottom: 10 },
          ].map((p, i) => (
            <div key={i} style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "#0E0E0F", ...p }} />
          ))}
        </div>
        <div style={{ position: "relative", height: 48, flex: 1 }}>
          <div className={a.tmHl1} style={{ ...D, position: "absolute", left: 0, top: 4, fontSize: 40, lineHeight: 1, whiteSpace: "nowrap" }}>{S.drawing.toUpperCase()}</div>
          <div className={a.tmHl2} style={{ ...D, position: "absolute", left: 0, top: 4, fontSize: 40, lineHeight: 1, color: "#FFC23D", whiteSpace: "nowrap" }} aria-live="polite">
            {S.teamsAre.toUpperCase()}
          </div>
        </div>
      </div>

      <div className={a.tmPanel} style={{ position: "absolute", left: 20, right: 20, top: 150, height: 190, borderRadius: 22, border: "3px solid #FFC23D", background: "rgba(255,194,61,0.08)" }}>
        <div style={{ position: "absolute", left: 18, top: 14, fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#FFC23D" }}>{S.teamA}</div>
      </div>
      <div className={a.tmPanel} style={{ position: "absolute", left: 20, right: 20, top: 526, height: 190, borderRadius: 22, border: "3px solid #C8261A", background: "rgba(200,38,26,0.1)" }}>
        <div style={{ position: "absolute", left: 18, top: 14, fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#FF6B57" }}>{S.teamB}</div>
      </div>

      <div className={a.tmVs} style={{ ...D, position: "absolute", left: 0, right: 0, top: 386, textAlign: "center", fontSize: 96, lineHeight: 1, color: "#FFFFFF" }}>VS</div>

      {chips.map((c, i) => {
        const ys = solo ? SLOTS2[i] : SLOTS4[i];
        const w = WOBBLE[i];
        const vars = {
          "--y0": `${ys[0]}px`,
          "--y1": `${ys[1]}px`,
          "--y2": `${ys[2]}px`,
          "--y3": `${ys[3]}px`,
          "--y4": `${ys[4]}px`,
          "--y5": `${ys[5]}px`,
          "--x1": `${w[0]}px`,
          "--x2": `${w[1]}px`,
          "--x3": `${w[2]}px`,
          "--x4": `${w[3]}px`,
          "--r1": `${Math.sign(w[0]) * 3}deg`,
          "--r2": `${Math.sign(w[1]) * 2}deg`,
          "--r3": `${Math.sign(w[2]) * 2}deg`,
          "--r4": `${Math.sign(w[3]) * 3}deg`,
          "--yf": `${finalY[c.team][c.slot]}px`,
          "--c": c.team === "A" ? "#FFC23D" : "#C8261A",
          "--fc": c.team === "A" ? "#0E0E0F" : "#FFFFFF",
          animationDelay: `${i * 0.07}s`,
        } as CSSProperties;
        return (
          <div key={`${c.name}-${i}`} className={a.tmChip} style={vars}>
            {c.name}
          </div>
        );
      })}

      <div className={cn(a.tmBtns)} style={{ position: "absolute", left: 20, right: 20, bottom: 26, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ textAlign: "center", fontSize: 14, color: "#9A9A96" }}>{sub}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}>
          <button type="button" onClick={onAgain} style={{ height: 52, borderRadius: 999, border: "2px solid #3A3A38", color: "#FFFFFF", fontWeight: 800, fontSize: 15 }}>
            {S.redraw}
          </button>
          <button type="button" onClick={onDone} style={{ height: 52, borderRadius: 999, background: "#FFC23D", color: "#0E0E0F", fontWeight: 800, fontSize: 15 }}>
            {doneLabel}
          </button>
        </div>
      </div>
    </Stage>
  );
}
