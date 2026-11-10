/**
 * MatPick
 *
 * The mat seen from above (a throw's top-down picture) with the zones and
 * mamas drawn over it, the caps of that throw circled and the spots caps
 * were knocked away from dashed. Optionally tappable (mat units, 824 × 265).
 * SpotsEditor builds on it to fix a throw: tap to add a cap, tap a circle to
 * remove it, then save. spotsLabel turns spots into "R3 (3 pt) + L2 (2 pt)".
 * With the zone fine-tuning (`fix`) the zones are drawn as calibrated, and
 * the stored spots (on the real print) are drawn where the camera saw them.
 */
"use client";

import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { MAT_H, MAT_W, refix, shootingBoxes, spotAt, unfix, zoneOutlines, type ZoneFix } from "@/lib/camera";
import { format, type Dictionary } from "@/lib/i18n";

export type Spot = { x: number; y: number };

/** "R3 (3 pt) + L2 (2 pt)", or "no cap". */
export function spotsLabel(spots: Spot[], C: Dictionary["cam"], L: Dictionary["camLive"]): string {
  if (!spots.length) return L.noCap;
  return spots
    .map((p) => {
      const z = spotAt(p);
      if (z.v === "mama") return format(C.mama, { side: z.id === "ML" ? C.left : C.right });
      if (z.v !== null) return format(C.zone, { id: z.id, v: z.v });
      return z.id === "off" ? C.off : C.none;
    })
    .join(" + ");
}

export function MatPick({
  src,
  spots,
  gone = [],
  label,
  onTap,
  fix,
  boxLabels,
}: Readonly<{ src: string | null; spots: Spot[]; gone?: Spot[]; label: string; onTap?: (p: Spot) => void; fix?: ZoneFix | null; boxLabels?: (string | null)[] }>) {
  function tap(e: ReactMouseEvent<HTMLButtonElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    // Tapped on the picture → the spot on the real print.
    onTap?.(unfix({ x: ((e.clientX - b.left) / b.width) * MAT_W, y: ((e.clientY - b.top) / b.height) * MAT_H }, fix));
  }
  const pt = (p: Spot) => refix(p, fix);
  const body = (
    <>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-auto block rounded-[12px] border border-line" />
      ) : (
        <div className="w-full rounded-[12px] border border-line bg-black" style={{ aspectRatio: `${MAT_W} / ${MAT_H}` }} />
      )}
      <svg viewBox={`0 0 ${MAT_W} ${MAT_H}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        {shootingBoxes(fix).map((b, i) => (
          <g key={`b${i}`}>
            <polygon points={b.map(([x, y]) => `${x},${y}`).join(" ")} fill="rgba(255,255,255,0.1)" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1.5} />
            {boxLabels?.[i] && (
              // Who throws from this box, a bit inside it towards the tip.
              <text
                x={(b[0][0] * 2 + b[1][0] + b.at(-1)![0]) / 4}
                y={(b[0][1] * 2 + b[1][1] + b.at(-1)![1]) / 4}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={20}
                fontWeight={800}
                fill="#ffb627"
                stroke="#000"
                strokeWidth={4}
                paintOrder="stroke"
              >
                {boxLabels[i]}
              </text>
            )}
          </g>
        ))}
        {zoneOutlines(fix).map((z) => (
          <polygon
            key={z.id}
            points={z.pts.map(([x, y]) => `${x},${y}`).join(" ")}
            fill={z.mama ? "rgba(255,107,91,0.12)" : "rgba(79,209,255,0.08)"}
            stroke={z.mama ? "#ff6b5b" : "#4fd1ff"}
            strokeWidth={1.5}
          />
        ))}
        {gone.map((p, i) => (
          <circle key={`g${i}`} cx={pt(p).x} cy={pt(p).y} r={20} fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={3} strokeDasharray="6 5" />
        ))}
        {spots.map((p, i) => (
          <circle key={`s${i}`} cx={pt(p).x} cy={pt(p).y} r={22} fill="none" stroke="#ffb627" strokeWidth={4} />
        ))}
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
export function warpedToJpeg(warped: Float32Array, w: number, h: number, quality = 0.72): string | null {
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
  const url = c.toDataURL("image/jpeg", quality);
  c.width = 0;
  c.height = 0;
  return url;
}

/** Fix one throw: tap to add a cap, tap a circle to take it away, save. */
export function SpotsEditor({
  src,
  initial,
  gone,
  C,
  L,
  onSave,
  onClose,
  fix,
  boxLabels,
}: Readonly<{
  src: string | null;
  initial: Spot[];
  gone: Spot[];
  C: Dictionary["cam"];
  L: Dictionary["camLive"];
  onSave: (s: Spot[]) => void;
  onClose: () => void;
  fix?: ZoneFix | null;
  boxLabels?: (string | null)[];
}>) {
  const [draft, setDraft] = useState(initial);
  const toggle = (p: Spot) =>
    setDraft((d) => {
      const near = d.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 28);
      return near >= 0 ? d.filter((_, i) => i !== near) : [...d, p].slice(0, 12);
    });
  const secondary = "h-12 rounded-[14px] bg-surface-deep border border-line-strong text-cream font-heading font-extrabold text-base tracking-[0.06em]";
  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-[15px] leading-normal text-soft">{L.whereSub}</p>
      <MatPick src={src} spots={draft} gone={gone} label={L.whereSub} onTap={toggle} fix={fix} boxLabels={boxLabels} />
      <p className="font-display font-extrabold text-xl leading-tight">{spotsLabel(draft, C, L)}</p>
      <button type="button" onClick={() => onSave(draft)} className="h-14 rounded-[16px] bg-amber text-ink font-heading font-extrabold text-lg tracking-[0.06em]">
        {L.save}
      </button>
      <button type="button" onClick={() => onSave([])} className={secondary}>
        {L.noCapBtn}
      </button>
      <button type="button" onClick={onClose} className="font-heading font-bold text-[13px] tracking-[0.08em] text-muted py-2">
        {L.cancel}
      </button>
    </div>
  );
}
