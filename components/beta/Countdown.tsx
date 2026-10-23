/**
 * Beta "3-2-1 Shuss" (Animaties › 3-2-1 Shuss · game start): the screen
 * flashes orange, red, gold with 3-2-1 and rings, then SHUSS! with a cap
 * burst. One run of 4.4s, then onDone. Tap anywhere to skip.
 */
"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { D, Stage } from "./Stage";
import a from "./start.module.css";

const SHARDS: [number, string, boolean][] = [
  [26, "#0E0E0F", false], [18, "#FFFFFF", true], [22, "#C8261A", true], [18, "#0E0E0F", false], [26, "#FF6B1A", true],
  [18, "#FFFFFF", true], [22, "#0E0E0F", false], [18, "#C8261A", true], [26, "#FFFFFF", true], [18, "#FF6B1A", true],
];

export function Countdown({ label, onDone }: Readonly<{ label?: string; onDone: () => void }>) {
  const { t } = useT();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(onDone, reduce ? 900 : 4150);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <Stage bg="#0E0E0F" rootClassName={a.cdBg} role="button" aria-label={t.beta.start.close} onClick={onDone}>
      {label && (
        <div className={a.cdLbl} style={{ position: "absolute", left: 20, right: 20, top: 50, textAlign: "center", fontSize: 13, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          {label}
        </div>
      )}

      <div className={cn(a.cdRing, a.cdR3)} style={{ border: "6px solid #FFFFFF" }} />
      <div className={cn(a.cdRing, a.cdR2)} style={{ border: "6px solid #0E0E0F" }} />
      <div className={cn(a.cdRing, a.cdR1)} style={{ border: "6px solid #FFFFFF" }} />

      <div className={cn(a.cdNum, a.cdN3)} style={{ ...D, color: "#FFFFFF" }}>3</div>
      <div className={cn(a.cdNum, a.cdN2)} style={{ ...D, color: "#0E0E0F" }}>2</div>
      <div className={cn(a.cdNum, a.cdN1)} style={{ ...D, color: "#FFFFFF" }}>1</div>

      <div style={{ position: "absolute", left: 195, top: 422, width: 0, height: 0 }} aria-hidden="true">
        {SHARDS.map(([size, bg, ring], k) => (
          <div key={k} style={{ position: "absolute", transform: `rotate(${k * 36}deg)` }}>
            <div className={a.cdSh} style={{ width: size, height: size, margin: -size / 2, borderRadius: "50%", background: bg, border: ring ? "3px solid #0E0E0F" : undefined, boxSizing: "border-box" }} />
          </div>
        ))}
      </div>

      <div className={a.cdGo} style={{ ...D, position: "absolute", left: 0, right: 0, top: 350, textAlign: "center", fontSize: 140, lineHeight: 1, color: "#0E0E0F", opacity: 0 }} aria-live="assertive">
        {t.beta.start.go}
      </div>
    </Stage>
  );
}
