/**
 * Camera field — every cap on the mat after a throw
 *
 * A camera throw used to store only what changed (caps landed, caps knocked
 * away). A cap knocked away that the camera missed then stayed on the mat
 * for good, and a ✓ only vouched for the new cap. Now the camera also keeps
 * the whole field after each throw: the previous field, minus knocked caps
 * and caps it no longer sees, plus the caps that landed. A person checks or
 * fixes that whole field, so a ✓ makes the picture a complete training
 * label. What the throw did (landed / knocked away) follows from comparing
 * the field before and after.
 *
 * Data: spots in mat units (824 × 265, lib/camera.ts), plain arrays in and out.
 */

export type FieldSpot = { x: number; y: number };

/** Two spots this close are the same cap (mat units; a cap is ~32 across). */
export const SAME_CAP = 24;
/** A knocked-away spot takes the nearest cap within this distance. */
const GONE_MAX = 40;

const dist = (a: FieldSpot, b: FieldSpot) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (list: FieldSpot[], p: FieldSpot, d = SAME_CAP) => list.some((q) => dist(q, p) < d);

/** The field after a throw: the caps that were there, minus the knocked
 * ones and the ones the camera no longer sees (`present`, when known), plus
 * the caps that landed. */
export function nextField(before: FieldSpot[], landed: FieldSpot[], gone: FieldSpot[], present: FieldSpot[] | null): FieldSpot[] {
  const kept = [...before];
  for (const g of gone) {
    let best = -1;
    let bd = GONE_MAX;
    kept.forEach((c, i) => {
      const d = dist(c, g);
      if (d < bd) [bd, best] = [d, i];
    });
    if (best >= 0) kept.splice(best, 1);
  }
  const still = present ? kept.filter((c) => near(present, c)) : kept;
  const out = [...still];
  for (const p of landed) if (!near(out, p)) out.push({ x: p.x, y: p.y });
  return out;
}

/** What a throw did, from the field before and after: caps that landed or
 * moved (`spots`) and spots caps left (`gone`). */
export function fieldDiff(before: FieldSpot[], after: FieldSpot[]): { spots: FieldSpot[]; gone: FieldSpot[] } {
  return {
    spots: after.filter((p) => !near(before, p)),
    gone: before.filter((p) => !near(after, p)),
  };
}
