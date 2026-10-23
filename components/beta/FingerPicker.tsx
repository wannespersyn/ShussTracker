/**
 * Beta Chwazi finger picker (Animaties › Chwazi · wie begint): everyone puts
 * a finger on the screen, each gets a coloured ring; once they hold still the
 * rings beat twice, one is picked and its gold floods the screen. On a
 * computer, clicks place (and remove) "fingers" so it can be tried out.
 */
"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { D } from "./Stage";
import st from "./stage.module.css";
import a from "./start.module.css";

const COLORS = ["#FF6B1A", "#4A6BFF", "#FF7FB0", "#C6F04A", "#FFFFFF", "#7BE08A", "#B48CFF", "#4FD1FF"];
const HOLD_MS = 1500;
const BEAT_MS = 1600;

type Finger = { id: number; x: number; y: number; c: string };

export function FingerPicker({ onClose, onDone, doneLabel }: Readonly<{ onClose: () => void; onDone: () => void; doneLabel: string }>) {
  const { t } = useT();
  const S = t.beta.start;
  const [fingers, setFingers] = useState<Finger[]>([]);
  const [phase, setPhase] = useState<"wait" | "beat" | "chosen">("wait");
  const [winner, setWinner] = useState<number | null>(null);
  const [nextColor, setNextColor] = useState(0);
  const countKey = fingers.map((f) => f.id).join(",");
  const live = useRef<Finger[]>([]);
  useEffect(() => {
    live.current = fingers;
  });

  useEffect(() => {
    if (phase !== "wait" || fingers.length < 2) return;
    const id = setTimeout(() => setPhase("beat"), HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, countKey, fingers.length]);

  useEffect(() => {
    if (phase !== "beat") return;
    const id = setTimeout(() => {
      const fs = live.current;
      setWinner(fs[Math.floor(Math.random() * fs.length)]?.id ?? null);
      setPhase("chosen");
      navigator.vibrate?.(60);
    }, BEAT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  function add(e: PointerEvent<HTMLDivElement>, id: number) {
    setFingers((fs) => [...fs, { id, x: e.clientX, y: e.clientY, c: COLORS[nextColor % COLORS.length] }]);
    setNextColor((n) => n + 1);
    if (phase === "beat") setPhase("wait");
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (phase === "chosen") return;
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.pointerType === "mouse") {
      const hit = fingers.find((f) => Math.hypot(f.x - e.clientX, f.y - e.clientY) < 48);
      if (hit) {
        setFingers((fs) => fs.filter((f) => f.id !== hit.id));
        if (phase === "beat") setPhase("wait");
      } else add(e, Date.now());
      return;
    }
    add(e, e.pointerId);
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || phase === "chosen") return;
    setFingers((fs) => fs.map((f) => (f.id === e.pointerId ? { ...f, x: e.clientX, y: e.clientY } : f)));
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || phase === "chosen") return;
    setFingers((fs) => fs.filter((f) => f.id !== e.pointerId));
    if (phase === "beat") setPhase("wait");
  }

  function reset() {
    setFingers([]);
    setWinner(null);
    setPhase("wait");
  }

  const win = fingers.find((f) => f.id === winner);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chwazi"
      className={st.root}
      style={{ backgroundColor: "#0E0E0F", color: "#FFFFFF", touchAction: "none" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {win && <div className={a.chFill} style={{ position: "absolute", left: win.x - 50, top: win.y - 50, width: 100, height: 100, borderRadius: "50%", background: "#FFC23D" }} />}

      <div style={{ position: "absolute", left: 20, right: 20, top: 44, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: phase === "chosen" ? "#0E0E0F" : "#B8B8B4" }}>CHWAZI</div>
        {phase !== "chosen" && (
          <div key={phase} className={a.chHint} style={{ ...D, marginTop: 6, fontSize: 34, color: phase === "beat" ? "#FFC23D" : "#FFFFFF" }}>
            {phase === "beat" ? S.choosing : S.fingers}
          </div>
        )}
        {phase === "wait" && fingers.length < 2 && (
          <div style={{ marginTop: 8, fontSize: 14, color: "#9A9A96" }}>{S.fingersHint}</div>
        )}
      </div>

      {fingers.map((f) => {
        const isWin = f.id === winner;
        const cls = phase === "beat" ? a.chBeat : phase === "chosen" ? (isWin ? a.chWin : a.chGone) : undefined;
        return (
          <div key={f.id} className={a.chRing} style={{ left: f.x, top: f.y, pointerEvents: "none", zIndex: isWin ? 2 : 1 }}>
            <div className={cls} style={{ position: "absolute", inset: 0 }}>
              <div className={a.chRipple} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `4px solid ${isWin ? "#FFC23D" : f.c}` }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `9px solid ${isWin ? "#0E0E0F" : f.c}`, background: isWin ? "#FFC23D" : undefined, boxSizing: "border-box" }} />
            </div>
          </div>
        );
      })}

      {phase === "chosen" && win && (
        <div className={a.chResult} style={{ position: "absolute", left: 20, right: 20, top: win.y > window.innerHeight * 0.5 ? "14%" : "56%", textAlign: "center", color: "#0E0E0F", pointerEvents: "none", zIndex: 3 }} aria-live="assertive">
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.16em" }}>{S.chosen}</div>
          <div style={{ ...D, fontSize: 130, lineHeight: 0.85, marginTop: 8 }}>{S.you}</div>
          <div style={{ ...D, fontSize: 40, lineHeight: 1, marginTop: 10 }}>{S.beginsGame}</div>
        </div>
      )}

      <button type="button" onClick={onClose} aria-label={S.close} style={{ position: "absolute", right: 10, top: 34, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: phase === "chosen" ? "#0E0E0F" : "#FFFFFF", zIndex: 4 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {phase === "chosen" && (
        <div className={cn(a.chResult)} style={{ position: "absolute", left: 20, right: 20, bottom: 32, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10, zIndex: 4, maxWidth: 480, margin: "0 auto" }}>
          <button type="button" onClick={reset} style={{ height: 54, borderRadius: 999, border: "2px solid #0E0E0F", color: "#0E0E0F", fontWeight: 800, fontSize: 15 }}>
            {S.redo}
          </button>
          <button type="button" onClick={onDone} style={{ height: 54, borderRadius: 999, background: "#0E0E0F", color: "#FFFFFF", fontWeight: 800, fontSize: 15 }}>
            {doneLabel}
          </button>
        </div>
      )}
    </div>
  );
}
