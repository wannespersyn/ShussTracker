/**
 * MatPick
 *
 * The mat seen from above (a throw's top-down picture) with the zones and
 * mamas drawn over it and the cap's spot marked. Optionally tappable: tap
 * where the cap really lies (mat units, 824 × 265).
 */
"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { MAT_H, MAT_W, REAL_MAMAS, REAL_ZONES } from "@/lib/camera";

type Spot = { x: number; y: number } | null;

export function MatPick({ src, spot, label, onTap }: Readonly<{ src: string | null; spot: Spot; label: string; onTap?: (p: { x: number; y: number }) => void }>) {
  function tap(e: ReactMouseEvent<HTMLButtonElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    onTap?.({ x: ((e.clientX - b.left) / b.width) * MAT_W, y: ((e.clientY - b.top) / b.height) * MAT_H });
  }
  const body = (
    <>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-auto block rounded-[12px] border border-line" />
      ) : (
        <div className="w-full rounded-[12px] border border-line bg-black" style={{ aspectRatio: `${MAT_W} / ${MAT_H}` }} />
      )}
      <svg viewBox={`0 0 ${MAT_W} ${MAT_H}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        {REAL_ZONES.map((z) => (
          <polygon key={z.id} points={z.pts.map(([x, y]) => `${x},${y}`).join(" ")} fill="rgba(79,209,255,0.08)" stroke="#4fd1ff" strokeWidth={1.5} />
        ))}
        {REAL_MAMAS.map((m) => (
          <rect key={m.id} x={m.x} y={m.y} width={m.w} height={m.h} fill="rgba(255,107,91,0.12)" stroke="#ff6b5b" strokeWidth={1.5} />
        ))}
        {spot && <circle cx={spot.x} cy={spot.y} r={22} fill="none" stroke="#ffb627" strokeWidth={4} />}
      </svg>
    </>
  );
  return onTap ? (
    <button type="button" onClick={tap} aria-label={label} className="relative block w-full">
      {body}
    </button>
  ) : (
    <figure className="relative" aria-label={label}>
      {body}
    </figure>
  );
}

/** A warped top-down frame (lib/camera) as a small JPEG data URL. */
export function warpedToJpeg(warped: Float32Array, w: number, h: number): string | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  for (let p = 0; p < w * h; p++) {
    img.data[p * 4] = warped[p * 3];
    img.data[p * 4 + 1] = warped[p * 3 + 1];
    img.data[p * 4 + 2] = warped[p * 3 + 2];
    img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL("image/jpeg", 0.72);
  c.width = 0;
  c.height = 0;
  return url;
}
