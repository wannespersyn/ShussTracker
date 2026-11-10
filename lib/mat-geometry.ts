/**
 * The real Leberschuss mat, measured on photos from above. One source for
 * the camera (lib/camera.ts) and the mat logger (lib/mat.ts).
 *
 * Space: the black playing field = 824 × 265 (x along the mat, y across).
 * Each end has a kite-shaped white diamond split into the 3-point tip, the
 * 2-point band ("DRINKING SINCE 2005") and the 1-point part with the Mena
 * logo; the mama is the red holder between the two bottles at each end; the
 * shooting boxes are the white corners where the field's corners are cut
 * off.
 */
export const FIELD_W = 824;
export const FIELD_H = 265;

export type P2 = [number, number];
const mirror = (pts: P2[]): P2[] => pts.map(([x, y]) => [FIELD_W - x, y]);
const L3: P2[] = [[60, 132.5], [147, 86], [147, 179]];
const L2: P2[] = [[147, 86], [237.5, 37.7], [237.5, 227.3], [147, 179]];
const L1: P2[] = [[237.5, 37.7], [282, 14], [361, 132.5], [282, 251], [237.5, 227.3]];

export const FIELD_ZONES: { id: string; v: number; pts: P2[] }[] = [
  { id: "L3", v: 3, pts: L3 },
  { id: "L2", v: 2, pts: L2 },
  { id: "L1", v: 1, pts: L1 },
  { id: "R1", v: 1, pts: mirror(L1) },
  { id: "R2", v: 2, pts: mirror(L2) },
  { id: "R3", v: 3, pts: mirror(L3) },
];
export const FIELD_MAMAS = [
  { id: "ML", x: 4, y: 98, w: 50, h: 69 },
  { id: "MR", x: FIELD_W - 54, y: 98, w: 50, h: 69 },
];
/** Bottle bases on either side of each mama. */
export const FIELD_BOTTLES: P2[] = [
  [24, 78],
  [24, 187],
  [FIELD_W - 24, 78],
  [FIELD_W - 24, 187],
];
/** How far the field's corners are cut off (the white shooting boxes). */
export const FIELD_CUT = 38;
