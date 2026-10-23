/**
 * Beta cap toss (Animaties › Cap toss · wie begint): a two-faced cap, SHUSS
 * (team A) or LEBER (team B). Tap the cap or the button to toss; the result
 * slams in with a coloured glow and a running SHUSS · LEBER tally. The
 * team that wins the toss chooses who begins; that choice is handed back.
 */
"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { CAP_PATH, D, Stage } from "./Stage";
import a from "./start.module.css";

export function CapToss({
  teamA,
  teamB,
  onClose,
  onDone,
}: Readonly<{ teamA: string; teamB: string; onClose: () => void; onDone: (starter: "A" | "B") => void }>) {
  const { t } = useT();
  const S = t.beta.start;
  const [n, setN] = useState(0);
  const [front, setFront] = useState(true);
  const [tally, setTally] = useState({ s: 0, l: 0 });
  const [landed, setLanded] = useState(false);

  function toss() {
    const f = Math.random() < 0.5;
    setLanded(false);
    setFront(f);
    setN((x) => x + 1);
    setTally((x) => ({ s: x.s + (f ? 1 : 0), l: x.l + (f ? 0 : 1) }));
  }

  const col = front ? "#FFC23D" : "#C8261A";

  return (
    <Stage bg="#0E0E0F" role="dialog" aria-modal="true" aria-label={S.capToss} boardStyle={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 32px" }}>
      <div key={`g${n}`} className={n ? a.tsGlow : undefined} style={{ position: "absolute", left: -100, right: -100, top: 280, height: 420, borderRadius: "50%", filter: "blur(40px)", opacity: 0, background: col }} />

      <button type="button" onClick={onClose} aria-label={S.close} style={{ position: "absolute", right: 10, top: 26, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", zIndex: 2 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div style={{ position: "relative", fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#B8B8B4" }}>{S.capToss.toUpperCase()}</div>
      <h1 style={{ ...D, position: "relative", margin: "6px 0 0", fontSize: 64, lineHeight: 0.9, textTransform: "uppercase", textAlign: "center" }}>{S.whoStarts}</h1>
      <div style={{ position: "relative", marginTop: 14, display: "flex", gap: 8, maxWidth: "100%" }}>
        <div style={{ padding: "7px 12px", borderRadius: 999, background: "#FFC23D", color: "#0E0E0F", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{format(S.sideA, { team: teamA })}</div>
        <div style={{ padding: "7px 12px", borderRadius: 999, background: "#C8261A", color: "#FFFFFF", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{format(S.sideB, { team: teamB })}</div>
      </div>

      <button type="button" aria-label={S.toss} onClick={toss} style={{ position: "relative", marginTop: 150, width: 220, height: 220, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", perspective: 900 }}>
        <div key={n} className={cn(a.tsCoin, n === 0 ? a.tsIdle : front ? a.tsF : a.tsB)} onAnimationEnd={() => n > 0 && setLanded(true)}>
          <div className={a.tsFace}>
            <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
              <path d={CAP_PATH} fill="#FFC23D" stroke="#FFC23D" strokeWidth="5" strokeLinejoin="round" />
              <circle cx="100" cy="100" r="70" fill="#FFD36B" stroke="#0E0E0F" strokeWidth="5" />
              <path d="M74 98 L74 70 L88 82 L100 62 L112 82 L126 70 L126 98 Z" fill="#0E0E0F" />
              <text x="100" y="138" textAnchor="middle" fontFamily="var(--font-bigs), sans-serif" fontWeight="900" fontSize="38" fill="#0E0E0F">
                {S.shuss}
              </text>
            </svg>
          </div>
          <div className={cn(a.tsFace, a.tsBack)}>
            <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
              <path d={CAP_PATH} fill="#C8261A" stroke="#C8261A" strokeWidth="5" strokeLinejoin="round" />
              <circle cx="100" cy="100" r="70" fill="#E0412F" stroke="#0E0E0F" strokeWidth="5" />
              <circle cx="100" cy="80" r="16" fill="none" stroke="#FFFFFF" strokeWidth="6" />
              <path d="M100 96 L100 106" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
              <text x="100" y="138" textAnchor="middle" fontFamily="var(--font-bigs), sans-serif" fontWeight="900" fontSize="38" fill="#FFFFFF">
                {S.leber}
              </text>
            </svg>
          </div>
        </div>
      </button>
      <div key={`s${n}`} className={n === 0 ? a.tsSh0 : a.tsSh} style={{ position: "relative", marginTop: 10, width: 150, height: 18, borderRadius: "50%", background: "#000000", filter: "blur(6px)" }} />

      <div style={{ position: "relative", height: 96, marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }} aria-live="polite">
        {n > 0 ? (
          <div key={`r${n}`} className={a.tsRes}>
            <div style={{ ...D, fontSize: 56, lineHeight: 1, color: front ? "#FFC23D" : "#FF6B57" }}>{front ? S.shuss : S.leber}!</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: "#D6D6D2" }}>{format(S.chooses, { team: front ? teamA : teamB })}</div>
          </div>
        ) : (
          <div style={{ fontSize: 16, fontWeight: 600, color: "#B8B8B4" }}>{S.tapToToss}</div>
        )}
      </div>

      <div style={{ position: "relative", marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, fontSize: 13, fontWeight: 800, color: "#B8B8B4" }}>
          <span>
            {S.shuss} {tally.s}
          </span>
          <span>·</span>
          <span>
            {S.leber} {tally.l}
          </span>
        </div>
        {landed ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {(["A", "B"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onDone(side)}
                  style={{ minHeight: 56, padding: "6px 12px", borderRadius: 999, background: side === "A" ? "#FFC23D" : "#C8261A", color: side === "A" ? "#0E0E0F" : "#FFFFFF", fontWeight: 800, fontSize: 14, lineHeight: 1.15 }}
                >
                  {format(S.begins, { team: side === "A" ? teamA : teamB })}
                </button>
              ))}
            </div>
            <button type="button" onClick={toss} style={{ height: 40, color: "#B8B8B4", fontWeight: 800, fontSize: 14 }}>
              {S.again}
            </button>
          </>
        ) : (
          <button type="button" onClick={toss} style={{ height: 56, borderRadius: 999, background: "#FFFFFF", color: "#0E0E0F", fontWeight: 800, fontSize: 17 }}>
            {n === 0 ? S.toss : S.again}
          </button>
        )}
      </div>
    </Stage>
  );
}
