/**
 * ZoneEditor
 *
 * Beta: fine-tune the zones one by one after the corners. The 4 corners put
 * the whole print in place, but never perfectly everywhere (a mat that isn't
 * flat, a wide-angle lens); here you pick a zone or mama, see it magnified
 * over the empty-mat photo and nudge it with the arrows until it lies exactly
 * on the print, and make it smaller or bigger (around its own centre).
 * The arrows move it the way they point on the screen, however
 * the mat lies in the photo. The nudges (ZoneFix, mat units) are applied to
 * every cap the camera finds (lib/camera.ts unfix).
 */
"use client";

import { useState } from "react";
import { FIX_IDS, fixedShape, isFixed, toPhoto, type Pt, type ZoneFix } from "@/lib/camera";
import { Overlay, type Photo } from "@/components/camera/CameraLab";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

/** One arrow tap, in mat units (fine / coarse), and one size tap. */
const STEP = { fine: 1.5, coarse: 6 };
const SIZE = { fine: 0.02, coarse: 0.08 };

export function ZoneEditor({ photo, corners, fix, onChange }: Readonly<{ photo: Photo; corners: Pt[]; fix: ZoneFix; onChange: (f: ZoneFix) => void }>) {
  const { t } = useT();
  const C = t.cam;
  const L = t.camLive;
  const [sel, setSel] = useState(FIX_IDS[0]);
  const [fine, setFine] = useState(true);
  const { w, h } = photo.frame;

  const pts = fixedShape(sel, fix);
  const mid = { x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length };
  const c = toPhoto(corners, mid);
  // How one mat unit along x and y looks in the photo around this zone.
  const ex = toPhoto(corners, { x: mid.x + 1, y: mid.y });
  const ey = toPhoto(corners, { x: mid.x, y: mid.y + 1 });
  const [ax, ay, bx, by] = [ex.x - c.x, ex.y - c.y, ey.x - c.x, ey.y - c.y];
  const det = ax * by - bx * ay;
  const unit = Math.hypot(ax, ay);

  /** Move the zone the way the arrow points on screen. */
  function move(sx: number, sy: number) {
    if (!det) return;
    const px = sx * unit * (fine ? STEP.fine : STEP.coarse);
    const py = sy * unit * (fine ? STEP.fine : STEP.coarse);
    const dx = (by * px - bx * py) / det;
    const dy = (-ay * px + ax * py) / det;
    const cur = fix[sel] ?? { dx: 0, dy: 0 };
    onChange({ ...fix, [sel]: { ...cur, dx: Math.round((cur.dx + dx) * 10) / 10, dy: Math.round((cur.dy + dy) * 10) / 10 } });
  }
  /** Smaller (-1) or bigger (+1), around the zone's own centre. */
  function resize(dir: number) {
    const cur = fix[sel] ?? { dx: 0, dy: 0 };
    const s = Math.min(1.5, Math.max(0.5, Math.round(((cur.s ?? 1) + dir * (fine ? SIZE.fine : SIZE.coarse)) * 100) / 100));
    onChange({ ...fix, [sel]: { ...cur, s } });
  }
  const size = Math.round((fix[sel]?.s ?? 1) * 100);
  function reset(all: boolean) {
    if (all) onChange({});
    else {
      const next = { ...fix };
      delete next[sel];
      onChange(next);
    }
  }

  // Zoom window: a bit more than the zone itself.
  const span = Math.max(...pts.map(([x, y]) => toPhoto(corners, { x, y })).flatMap((p) => [Math.abs(p.x - c.x), Math.abs(p.y - c.y)]), unit * 20) * 2.6;
  const label = (id: string) => (id === "ML" || id === "MR" ? format(C.mama, { side: id === "ML" ? C.left : C.right }) : id);
  const moved = (id: string) => isFixed(fix[id]);
  const arrow = "h-14 rounded-[14px] bg-surface-deep border border-line-strong text-cream text-2xl font-bold active:bg-surface-raised";

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-[13px] leading-normal text-muted">{L.zonesSub}</p>
      <div role="group" aria-label={L.zonesTitle} className="flex flex-wrap gap-1.5">
        {FIX_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={sel === id}
            onClick={() => setSel(id)}
            className={cn(
              "h-10 px-3 rounded-pill font-heading font-bold text-sm",
              sel === id ? "bg-amber text-ink" : moved(id) ? "bg-mint/15 text-mint border border-mint/40" : "bg-surface-deep border border-line text-soft",
            )}
          >
            {label(id)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
        <svg viewBox={`${c.x - span / 2} ${c.y - span / 2} ${span} ${span}`} className="w-full aspect-square rounded-[14px] border border-line-strong bg-black" aria-label={label(sel)}>
          <image href={photo.url} x={0} y={0} width={w} height={h} />
          <Overlay corners={corners} w={span * 1.5} fix={fix} focus={sel} />
        </svg>
        <div className="grid grid-cols-3 gap-1.5 w-44">
          <span />
          <button type="button" onClick={() => move(0, -1)} aria-label={C.up} className={arrow}>↑</button>
          <span />
          <button type="button" onClick={() => move(-1, 0)} aria-label={C.left2} className={arrow}>←</button>
          <button type="button" onClick={() => reset(false)} aria-label={L.zoneReset} className="h-14 rounded-[14px] border border-line-strong text-[11px] font-heading font-bold tracking-[0.08em] text-muted">
            {L.zoneReset}
          </button>
          <button type="button" onClick={() => move(1, 0)} aria-label={C.right2} className={arrow}>→</button>
          <span />
          <button type="button" onClick={() => move(0, 1)} aria-label={C.down} className={arrow}>↓</button>
          <button type="button" onClick={() => setFine((f) => !f)} aria-pressed={!fine} className="h-14 rounded-[14px] border border-line-strong text-[11px] font-heading font-bold tracking-[0.08em] text-muted">
            {fine ? C.fine : C.coarse}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <button type="button" onClick={() => resize(-1)} className="h-12 rounded-[14px] bg-surface-deep border border-line-strong font-heading font-extrabold text-sm tracking-[0.06em]">
          − {L.zoneSmaller}
        </button>
        <span className="font-display font-extrabold text-lg tabular-nums w-16 text-center">{size}%</span>
        <button type="button" onClick={() => resize(1)} className="h-12 rounded-[14px] bg-surface-deep border border-line-strong font-heading font-extrabold text-sm tracking-[0.06em]">
          + {L.zoneBigger}
        </button>
      </div>

      {FIX_IDS.some(moved) && (
        <button type="button" onClick={() => reset(true)} className="self-start font-heading font-bold text-[13px] tracking-[0.08em] text-muted py-1">
          {L.zonesResetAll}
        </button>
      )}
    </div>
  );
}
