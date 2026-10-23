/**
 * Beta motion stage: a full-screen overlay that renders a fixed 390×844
 * artboard (the size the Animaties/Wrapped designs were drawn at), scaled to
 * fit the viewport and centred. Children are positioned exactly like in the
 * designs; the background colour fills the whole screen around the board.
 */
"use client";

import { useSyncExternalStore, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./stage.module.css";

export const STAGE_W = 390;
export const STAGE_H = 844;

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const scaleNow = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);

/** Current board scale (1 on the server). */
export function useStageScale() {
  return useSyncExternalStore(subscribe, scaleNow, () => 1);
}

export function Stage({
  bg,
  color = "#FFFFFF",
  rootClassName,
  boardClassName,
  boardStyle,
  children,
  ...rest
}: Readonly<
  {
    bg: string;
    color?: string;
    /** Extra class on the full-screen layer (e.g. an animated background). */
    rootClassName?: string;
    boardClassName?: string;
    boardStyle?: CSSProperties;
    children: ReactNode;
  } & HTMLAttributes<HTMLDivElement>
>) {
  const k = useStageScale();
  return (
    <div {...rest} className={cn(s.root, rootClassName)} style={{ backgroundColor: bg, color, ...rest.style }}>
      <div className={cn(s.board, boardClassName)} style={{ transform: `translate(-50%, -50%) scale(${k})`, ...boardStyle }}>
        {children}
      </div>
    </div>
  );
}

/** Shared bits of the designs' look: display face, body face. */
export const D: CSSProperties = { fontFamily: "var(--font-bigs), var(--font-display), sans-serif", fontWeight: 900 };
export const CAP_PATH =
  "M100.0 4.0 L112.5 16.9 L128.3 8.3 L136.4 24.3 L154.1 20.7 L157.1 38.4 L175.1 40.1 L172.7 58.0 L189.4 64.9 L181.9 81.3 L195.7 92.8 L183.8 106.3 L193.6 121.4 L178.2 130.7 L183.1 148.0 L165.7 152.4 L165.3 170.4 L147.3 169.4 L141.7 186.5 L124.8 180.3 L114.3 194.9 L100.0 184.0 L85.7 194.9 L75.2 180.3 L58.3 186.5 L52.7 169.4 L34.7 170.4 L34.3 152.4 L16.9 148.0 L21.8 130.7 L6.4 121.4 L16.2 106.3 L4.3 92.8 L18.1 81.3 L10.6 64.9 L27.3 58.0 L24.9 40.1 L42.9 38.4 L45.9 20.7 L63.6 24.3 L71.7 8.3 L87.5 16.9 Z";
export const FLAME_PATH = "M100 6 C118 52 170 78 166 150 C162 208 128 244 100 244 C72 244 36 212 34 156 C32 110 62 96 66 52 C82 74 90 84 100 6 Z";
export const HEX = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

/** Burst of round shards from one point (12 by default), as in the designs. */
export function Shards({
  x,
  y,
  n = 12,
  colors = ["#FFC23D", "#FF6B1A", "#C8261A", "#FFFFFF"],
  big = 22,
  small = 14,
  border = 3,
  className,
  delay = 0,
  offset = 0,
}: Readonly<{ x: number; y: number; n?: number; colors?: string[]; big?: number; small?: number; border?: number; className: string; delay?: number | ((k: number) => number); offset?: number }>) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }} aria-hidden="true">
      {Array.from({ length: n }, (_, k) => {
        const size = k % 3 === 0 ? big : small;
        const d = typeof delay === "function" ? delay(k) : delay;
        return (
          <div key={k} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transform: `rotate(${k * (360 / n) + offset}deg)` }}>
            <div
              className={className}
              style={{ position: "absolute", left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: "50%", border: `${border}px solid #0E0E0F`, boxSizing: "border-box", background: colors[k % colors.length], animationDelay: `${d}s` }}
            />
          </div>
        );
      })}
    </div>
  );
}
