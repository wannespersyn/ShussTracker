/**
 * Camera mat detection (beta prototype)
 *
 * Finds caps on a photo of the mat taken from above. The four mat corners
 * (tapped once) give a homography from mat space to the photo; every photo
 * is warped into a small top-down mat image, compared with the photo of the
 * empty mat and with the previous photo: what's new since the last photo is
 * where a cap landed, what's gone is a cap that got shot away. Each blob's
 * centre is mapped to its zone / mama on the mat.
 *
 * Data: raw RGBA pixels in, mat coordinates (824 × 265, lib/mat.ts) out.
 * Notes: pure JS, no OpenCV — a spike to test on real photos.
 */
import { MAMAS, ZONES } from "@/lib/mat";

export const MAT_W = 824;
export const MAT_H = 265;
/** Warped image size (mat space × SCALE). */
export const SCALE = 0.5;
export const WW = Math.round(MAT_W * SCALE);
export const WH = Math.round(MAT_H * SCALE);

export type Pt = { x: number; y: number };
/** 3×3 homography, row-major. */
export type H = number[];
export type Frame = { w: number; h: number; data: Uint8ClampedArray };
export type Blob = { x: number; y: number; area: number };
export type Detection = {
  landed: Blob[];
  gone: Blob[];
  /** Something big in view (a hand, an arm): retake the photo. */
  occluded: boolean;
  /** Cap-sized blobs that differ from the empty mat right now. */
  present: Blob[];
};

/** Solves the 8 unknowns of H mapping src[i] → dst[i] (DLT, h33 = 1). */
export function homography(src: Pt[], dst: Pt[]): H {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with partial pivoting on the 8×9 augmented matrix.
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 9; k++) A[c][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [...A.map((row) => row[8]), 1];
}

export function apply(h: H, p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Mat corners in mat space, in the order the user taps them: the four
 * corners going round, starting at the left mama's top. */
export const MAT_CORNERS: Pt[] = [
  { x: 0, y: 0 },
  { x: MAT_W, y: 0 },
  { x: MAT_W, y: MAT_H },
  { x: 0, y: MAT_H },
];

/** Warps a photo into a WW × WH top-down RGB image (3 bytes per pixel),
 * with a 3×3 box blur against noise. `toPhoto` maps mat → photo. */
export function warp(frame: Frame, toPhoto: H): Uint8ClampedArray {
  const raw = new Uint8ClampedArray(WW * WH * 3);
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) {
      const p = apply(toPhoto, { x: (x + 0.5) / SCALE, y: (y + 0.5) / SCALE });
      const px = Math.min(frame.w - 1, Math.max(0, Math.round(p.x)));
      const py = Math.min(frame.h - 1, Math.max(0, Math.round(p.y)));
      const i = (py * frame.w + px) * 4;
      const o = (y * WW + x) * 3;
      raw[o] = frame.data[i];
      raw[o + 1] = frame.data[i + 1];
      raw[o + 2] = frame.data[i + 2];
    }
  const out = new Uint8ClampedArray(raw.length);
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= WW || yy >= WH) continue;
            s += raw[(yy * WW + xx) * 3 + c];
            n++;
          }
        out[(y * WW + x) * 3 + c] = s / n;
      }
  return out;
}

/** Per-pixel colour distance between two warped images, normalised for
 * overall brightness (so a cloud or a lamp doesn't light up the whole mat). */
function diff(a: Uint8ClampedArray, b: Uint8ClampedArray): Float32Array {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    ma += a[i];
    mb += b[i];
  }
  const k = mb > 0 ? ma / mb : 1;
  const out = new Float32Array(WW * WH);
  for (let p = 0; p < out.length; p++) {
    const i = p * 3;
    out[p] = Math.abs(a[i] - b[i] * k) + Math.abs(a[i + 1] - b[i + 1] * k) + Math.abs(a[i + 2] - b[i + 2] * k);
  }
  return out;
}

function mask(d: Float32Array, min: number): Uint8Array {
  let sum = 0;
  let sq = 0;
  for (const v of d) {
    sum += v;
    sq += v * v;
  }
  const mean = sum / d.length;
  const sd = Math.sqrt(Math.max(0, sq / d.length - mean * mean));
  const t = Math.max(min, mean + 3 * sd);
  const m = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) m[i] = d[i] > t ? 1 : 0;
  return m;
}

/** Connected blobs (4-neighbour) with centre in mat coordinates. */
export function blobs(m: Uint8Array): Blob[] {
  const seen = new Uint8Array(m.length);
  const out: Blob[] = [];
  const stack: number[] = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    let area = 0;
    let sx = 0;
    let sy = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % WW;
      const y = (p - x) / WW;
      area++;
      sx += x;
      sy += y;
      for (const q of [p - 1, p + 1, p - WW, p + WW]) {
        if (q < 0 || q >= m.length || seen[q] || !m[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === WW - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    out.push({ x: (sx / area + 0.5) / SCALE, y: (sy / area + 0.5) / SCALE, area: area / (SCALE * SCALE) });
  }
  return out;
}

/** A cap is ~32 mat units across (≈ 800 units²); allow for blur and shadow. */
export const CAP_MIN = 250;
export const CAP_MAX = 3500;
export const HAND_MIN = 9000;

const caps = (bs: Blob[]) => bs.filter((b) => b.area >= CAP_MIN && b.area <= CAP_MAX);

/** Compares the current photo with the empty mat and the previous photo. */
export function detect(empty: Uint8ClampedArray, prev: Uint8ClampedArray, cur: Uint8ClampedArray, minDiff = 60): Detection {
  const nowMask = mask(diff(cur, empty), minDiff);
  const prevMask = mask(diff(prev, empty), minDiff);
  const landed = new Uint8Array(nowMask.length);
  const gone = new Uint8Array(nowMask.length);
  for (let i = 0; i < nowMask.length; i++) {
    landed[i] = nowMask[i] && !prevMask[i] ? 1 : 0;
    gone[i] = prevMask[i] && !nowMask[i] ? 1 : 0;
  }
  const all = blobs(nowMask);
  return {
    landed: caps(blobs(landed)),
    gone: caps(blobs(gone)),
    present: caps(all),
    occluded: all.some((b) => b.area >= HAND_MIN),
  };
}

function inPoly(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Where a point lies on the mat: a zone ("L2", value 2), a mama, or nothing. */
export function spotAt(p: Pt): { id: string; v: number | "mama" | null } {
  for (const m of MAMAS) if (p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) return { id: m.id, v: "mama" };
  for (const z of ZONES) if (inPoly(p.x, p.y, z.pts)) return { id: z.id, v: z.v };
  if (p.x < 0 || p.x > MAT_W || p.y < 0 || p.y > MAT_H) return { id: "off", v: null };
  return { id: "none", v: null };
}
