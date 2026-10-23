/**
 * Beta Chwazi for teams: every player holds a finger on their own name pad.
 * Once all pads are held the pads beat twice, then each one flips to its
 * team colour (duos), so the app knows the teams. On a computer, clicks
 * toggle a pad as "held" so it can be tried out.
 */
"use client";

import { useEffect, useState, type PointerEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { D } from "./Stage";
import st from "./stage.module.css";
import a from "./start.module.css";

const TEAM = [
  { bg: "#FFC23D", fg: "#0E0E0F" },
  { bg: "#C8261A", fg: "#FFFFFF" },
  { bg: "#4A6BFF", fg: "#FFFFFF" },
  { bg: "#C6F04A", fg: "#0E0E0F" },
];
const HOLD_MS = 900;
const BEAT_MS = 1600;

export function TeamFingers({
  players,
  onClose,
  onDone,
  doneLabel,
}: Readonly<{
  players: { id: string; name: string }[];
  onClose: () => void;
  /** Player ids in team order: [A1, A2, B1, B2, …]. */
  onDone: (orderedIds: string[]) => void;
  doneLabel: string;
}>) {
  const { t } = useT();
  const S = t.beta.start;
  // pointerId (or -1 for mouse) → player id
  const [held, setHeld] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<"wait" | "beat" | "done">("wait");
  const [teamOf, setTeamOf] = useState<Record<string, number>>({});
  const allHeld = players.every((p) => held[p.id] !== undefined);

  useEffect(() => {
    if (phase !== "wait" || !allHeld) return;
    const id = setTimeout(() => setPhase("beat"), HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, allHeld]);

  useEffect(() => {
    if (phase !== "beat") return;
    const id = setTimeout(() => {
      const ids = players.map((p) => p.id).sort(() => Math.random() - 0.5);
      setTeamOf(Object.fromEntries(ids.map((pid, i) => [pid, Math.floor(i / 2)])));
      setPhase("done");
      navigator.vibrate?.(60);
    }, BEAT_MS);
    return () => clearTimeout(id);
  }, [phase, players]);

  function press(e: PointerEvent, pid: string) {
    if (phase === "done") return;
    e.stopPropagation();
    if (e.pointerType === "mouse") {
      setHeld((h) => {
        const next = { ...h };
        if (next[pid] !== undefined) delete next[pid];
        else next[pid] = -1;
        return next;
      });
    } else {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setHeld((h) => ({ ...h, [pid]: e.pointerId }));
    }
    if (phase === "beat") setPhase("wait");
  }

  function release(e: PointerEvent) {
    if (e.pointerType === "mouse" || phase === "done") return;
    setHeld((h) => Object.fromEntries(Object.entries(h).filter(([, v]) => v !== e.pointerId)));
    if (phase === "beat") setPhase("wait");
  }

  function reset() {
    setHeld({});
    setTeamOf({});
    setPhase("wait");
  }

  function finish() {
    const ordered = [...players].sort((x, y) => teamOf[x.id] - teamOf[y.id]).map((p) => p.id);
    onDone(ordered);
  }

  const cols = 2;
  const size = players.length > 4 ? 112 : 136;
  const title = phase === "done" ? S.teamsAre.toUpperCase() : phase === "beat" ? S.choosing : S.fingerOnName;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={S.optFingerTeams}
      className={st.root}
      style={{ backgroundColor: "#0E0E0F", color: "#FFFFFF", touchAction: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "34px 20px 28px" }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" onClick={onClose} aria-label={S.close} style={{ position: "absolute", right: 10, top: 28, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#B8B8B4" }}>CHWAZI · TEAMS</div>
      <div key={phase} className={a.chHint} style={{ ...D, marginTop: 6, fontSize: 34, textAlign: "center", color: phase === "wait" ? "#FFFFFF" : "#FFC23D" }} aria-live="polite">
        {title}
      </div>
      <div style={{ marginTop: 6, minHeight: 20, fontSize: 14, color: "#9A9A96", textAlign: "center" }}>
        {phase === "wait" && (allHeld ? S.holdStill : S.fingerOnNameHint)}
      </div>

      <div style={{ flex: 1, width: "100%", maxWidth: 420, display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, alignContent: "center", justifyItems: "center", gap: 18 }}>
        {players.map((p, i) => {
          const on = held[p.id] !== undefined;
          const team = teamOf[p.id];
          const look = phase === "done" ? TEAM[team % TEAM.length] : null;
          return (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                onPointerDown={(e) => press(e, p.id)}
                className={phase === "beat" ? a.chBeat : phase === "done" ? st.pop : undefined}
                style={{
                  position: "relative",
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: 10,
                  boxSizing: "border-box",
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: 1.1,
                  cursor: "pointer",
                  background: look ? look.bg : on ? "#2A2A2A" : "#1C1C1D",
                  color: look ? look.fg : "#FFFFFF",
                  border: `5px solid ${look ? "#0E0E0F" : on ? "#FFC23D" : "#3A3A38"}`,
                  boxShadow: look ? `0 0 0 4px ${look.bg}` : undefined,
                  animationDelay: phase === "done" ? `${i * 0.06}s` : undefined,
                  transition: "background-color .15s, border-color .15s",
                  overflow: "hidden",
                }}
              >
                {on && phase === "wait" && <div className={a.chRipple} style={{ position: "absolute", inset: -5, borderRadius: "50%", border: "4px solid #FFC23D", pointerEvents: "none" }} />}
                <span style={{ pointerEvents: "none", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              </div>
              <div style={{ height: 16, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: look ? look.bg : "transparent" }}>
                {look ? `TEAM ${String.fromCharCode(65 + team)}` : "·"}
              </div>
            </div>
          );
        })}
      </div>

      {phase === "done" && (
        <div className={a.chResult} style={{ width: "100%", maxWidth: 480, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}>
          <button type="button" onClick={reset} style={{ height: 54, borderRadius: 999, border: "2px solid #3A3A38", color: "#FFFFFF", fontWeight: 800, fontSize: 15 }}>
            {S.redo}
          </button>
          <button type="button" onClick={finish} style={{ height: 54, borderRadius: 999, background: "#FFC23D", color: "#0E0E0F", fontWeight: 800, fontSize: 15 }}>
            {doneLabel}
          </button>
        </div>
      )}
    </div>
  );
}
