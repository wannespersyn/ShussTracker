/**
 * Mat rotation (camera beta)
 *
 * Turn every picture of the mat by 90° steps so it looks the way you sit at
 * the mat: the photo for the corners, the zone editor and the throw
 * pictures. The choice is kept on this phone. Helpers to draw a rotated
 * picture in SVG and to turn an arrow on screen back into a direction on
 * the picture.
 */
"use client";

import { useSyncExternalStore } from "react";

export type Rot = 0 | 90 | 180 | 270;
const KEY = "shuss.camera.rotation";

/** The rotation kept on this phone, and a function to turn it 90° further.
 * Read through useSyncExternalStore so the server render (0°) and the
 * phone's choice don't clash. */
const listeners = new Set<() => void>();
function read(): Rot {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v === 90 || v === 180 || v === 270 ? v : 0;
  } catch {
    return 0;
  }
}
export function useMatRotation(): [Rot, () => void] {
  const rot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => 0 as Rot,
  );
  function turn() {
    try {
      localStorage.setItem(KEY, String((read() + 90) % 360));
    } catch {
      /* private mode */
    }
    listeners.forEach((cb) => cb());
  }
  return [rot, turn];
}

/** viewBox size and the transform that puts a w × h picture, turned by
 * `rot` clockwise, into it. */
export function rotated(w: number, h: number, rot: Rot): { vw: number; vh: number; transform: string } {
  if (rot === 90) return { vw: h, vh: w, transform: `translate(${h} 0) rotate(90)` };
  if (rot === 180) return { vw: w, vh: h, transform: `translate(${w} ${h}) rotate(180)` };
  if (rot === 270) return { vw: h, vh: w, transform: `translate(0 ${w}) rotate(270)` };
  return { vw: w, vh: h, transform: "" };
}

/** An arrow on screen (sx, sy) → the same direction on the unturned picture. */
export function unturn(sx: number, sy: number, rot: Rot): [number, number] {
  const a = (-rot * Math.PI) / 180;
  return [Math.round(sx * Math.cos(a) - sy * Math.sin(a)), Math.round(sx * Math.sin(a) + sy * Math.cos(a))];
}

/** A pointer event → a point on the picture inside the turned group. */
export function pointIn(g: SVGGElement, clientX: number, clientY: number): { x: number; y: number } {
  const svg = g.ownerSVGElement!;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(g.getScreenCTM()!.inverse());
  return { x: p.x, y: p.y };
}

/** "↻" button that turns the mat pictures. */
export function RotateButton({ onClick, label }: Readonly<{ onClick: () => void; label: string }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream text-lg flex items-center justify-center"
    >
      ↻
    </button>
  );
}
