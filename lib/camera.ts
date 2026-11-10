/**
 * Camera mat detection (beta)
 *
 * Finds caps on photos of the mat taken from above — handheld is fine:
 *  1. find the black playing field in every photo (largest dark area) and
 *     fit its four edges, ignoring the bottles at the ends → corners; then
 *     place the ends exactly using the two white tip triangles;
 *  2. fine-tune those corners against the reference photo (small search
 *     that minimises the pixel difference), and pick which end is which;
 *  3. warp to a small top-down image of the mat (824 × 265 mat space);
 *  4. compare high-passed images (so glare and light changes don't count),
 *     allowing a 1-pixel shift, forgiving the mat's own print (letters and
 *     edges differ when photos are a hair off), bottle ends masked out;
 *  5. average that over cap-sized squares, so a cap counts both as a solid
 *     disk (on black) and as just a dark rim (on white); peaks that appeared
 *     since the previous photo = caps that landed, peaks that vanished =
 *     caps shot away, a huge changed area = a hand;
 *  6. optional per-zone nudges (ZoneFix) on top of the corners: a found
 *     cap is moved back onto the real print (`unfix`).
 *
 * Data: raw RGBA pixels in, mat coordinates (lib/mat.ts) out. Pure JS.
 * Notes: tuned on real photos of the Leberschuss mat (black field, white
 * zones, silver caps) in a lit room.
 */

import { FIELD_CUT, FIELD_MAMAS, FIELD_ZONES } from "@/lib/mat-geometry";

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
/** Centre in mat coordinates; `fill` = share of its bounding box it covers, `aspect` = long / short side. */
export type Blob = { x: number; y: number; area: number; fill: number; aspect: number };
export type Detection = {
  landed: Blob[];
  gone: Blob[];
  /** Something big in view (a hand, an arm): retake the photo. */
  occluded: boolean;
  /** Cap-sized blobs that differ from the empty mat right now. */
  present: Blob[];
};

/** Mat corners in mat space: left end top, right end top, right end bottom, left end bottom. */
export const MAT_CORNERS: Pt[] = [
  { x: 0, y: 0 },
  { x: MAT_W, y: 0 },
  { x: MAT_W, y: MAT_H },
  { x: 0, y: MAT_H },
];

/** Solves the 8 unknowns of H mapping src[i] → dst[i] (DLT, h33 = 1). */
export function homography(src: Pt[], dst: Pt[]): H {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
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

/** Corners of the black playing field in a photo (photo pixels), in
 * MAT_CORNERS order up to a 180° turn (see `orient`). Null if no field. */
export function findField(frame: Frame): Pt[] | null {
  // Work on a ≤ 480 px copy: plenty for edges, fast on a phone.
  const k = Math.min(1, 480 / Math.max(frame.w, frame.h));
  const w = Math.max(1, Math.round(frame.w * k));
  const h = Math.max(1, Math.round(frame.h * k));
  // Dark, grey pixels; the cut-off adapts to the light (Otsu on luma, capped).
  const lum = new Float32Array(w * h);
  const grey = new Uint8Array(w * h);
  const hist = new Float64Array(256);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (Math.min(frame.h - 1, Math.floor(y / k)) * frame.w + Math.min(frame.w - 1, Math.floor(x / k))) * 4;
      const r = frame.data[i];
      const g = frame.data[i + 1];
      const b = frame.data[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      lum[y * w + x] = l;
      grey[y * w + x] = Math.max(r, g, b) - Math.min(r, g, b) < 45 ? 1 : 0;
      hist[Math.min(255, Math.round(l))]++;
    }
  const cut = Math.min(95, Math.max(40, otsu(hist) * 0.8));
  let dark: Uint8Array = new Uint8Array(w * h);
  for (let p = 0; p < dark.length; p++) dark[p] = lum[p] < cut && grey[p] ? 1 : 0;
  dark = morph(morph(morph(morph(dark, w, h, false), w, h, false), w, h, true), w, h, true); // opening ×2
  const comp = largest(dark, w, h);
  if (!comp || comp.length < w * h * 0.05) return null;

  // Long axis by PCA.
  let mx = 0;
  let my = 0;
  for (const p of comp) {
    mx += p % w;
    my += Math.floor(p / w);
  }
  mx /= comp.length;
  my /= comp.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of comp) {
    const dx = (p % w) - mx;
    const dy = Math.floor(p / w) - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let u = { x: Math.cos(ang), y: Math.sin(ang) };
  if (u.x < 0) u = { x: -u.x, y: -u.y };
  const n = { x: -u.y, y: u.x };
  const S = new Float32Array(comp.length);
  const T = new Float32Array(comp.length);
  let smin = Infinity;
  let smax = -Infinity;
  comp.forEach((p, i) => {
    const dx = (p % w) - mx;
    const dy = Math.floor(p / w) - my;
    S[i] = dx * u.x + dy * u.y;
    T[i] = dx * n.x + dy * n.y;
    smin = Math.min(smin, S[i]);
    smax = Math.max(smax, S[i]);
  });
  // Long edges from the middle 70% (the bottles stand at the ends).
  const L = smax - smin;
  const NB = 60;
  const topMin = new Float32Array(NB).fill(Infinity);
  const botMax = new Float32Array(NB).fill(-Infinity);
  const lo = smin + 0.15 * L;
  const span = 0.7 * L;
  for (let i = 0; i < S.length; i++) {
    const b = Math.floor(((S[i] - lo) / span) * NB);
    if (b < 0 || b >= NB) continue;
    if (T[i] < topMin[b]) topMin[b] = T[i];
    if (T[i] > botMax[b]) botMax[b] = T[i];
  }
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let b = 0; b < NB; b++) {
    const s = lo + ((b + 0.5) / NB) * span;
    if (Number.isFinite(topMin[b])) top.push([s, topMin[b]]);
    if (Number.isFinite(botMax[b])) bot.push([s, botMax[b]]);
  }
  if (top.length < 5 || bot.length < 5) return null;
  const tTop = median(top.map((p) => p[1]));
  const tBot = median(bot.map((p) => p[1]));
  // Short edges from the middle 50% across.
  const tlo = tTop + 0.25 * (tBot - tTop);
  const tspan = 0.5 * (tBot - tTop);
  const NR = 30;
  const leftMin = new Float32Array(NR).fill(Infinity);
  const rightMax = new Float32Array(NR).fill(-Infinity);
  for (let i = 0; i < S.length; i++) {
    const b = Math.floor(((T[i] - tlo) / tspan) * NR);
    if (b < 0 || b >= NR) continue;
    if (S[i] < leftMin[b]) leftMin[b] = S[i];
    if (S[i] > rightMax[b]) rightMax[b] = S[i];
  }
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let b = 0; b < NR; b++) {
    const t = tlo + ((b + 0.5) / NR) * tspan;
    if (Number.isFinite(leftMin[b])) left.push([t, leftMin[b]]);
    if (Number.isFinite(rightMax[b])) right.push([t, rightMax[b]]);
  }
  if (left.length < 4 || right.length < 4) return null;
  const T1 = fitLine(top);
  const B1 = fitLine(bot);
  const L1 = fitLine(left);
  const R1 = fitLine(right);
  // t = a1 s + b1 meets s = a2 t + b2.
  const meet = ([a1, b1]: [number, number], [a2, b2]: [number, number]): Pt => {
    const s = (a2 * b1 + b2) / (1 - a2 * a1);
    const t = a1 * s + b1;
    return { x: (mx + s * u.x + t * n.x) / k, y: (my + s * u.y + t * n.y) / k };
  };
  const rough = [meet(T1, L1), meet(T1, R1), meet(B1, R1), meet(B1, L1)];
  return fitToPrint(frame, refineEnds(frame, refineEnds(frame, rough)));
}

/** The outline of the white diamond at each end (sharp corners; the print
 * rounds them off, so only the middle of each side is used). */
const KITE: [number, number][] = [
  [60, 132.5],
  [282, 12],
  [361, 132.5],
  [282, 253],
];

/** Pairs of mat points just inside / just outside the diamonds' sides. */
const PRINT_SAMPLES: [Pt, Pt][] = (() => {
  const out: [Pt, Pt][] = [];
  const D = 4;
  for (const side of [1, -1])
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = KITE[e];
      const [bx, by] = KITE[(e + 1) % 4];
      const len = Math.hypot(bx - ax, by - ay);
      // Outward normal (the diamond is drawn clockwise in mat space).
      const nx = (by - ay) / len;
      const ny = -(bx - ax) / len;
      for (let i = 0; i < 24; i++) {
        const t = 0.12 + (0.76 * i) / 23;
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const inside = { x: x - nx * D, y: y - ny * D };
        const outside = { x: x + nx * D, y: y + ny * D };
        const m = (p: Pt): Pt => (side === 1 ? p : { x: MAT_W - p.x, y: p.y });
        out.push([m(inside), m(outside)]);
      }
    }
  return out;
})();

/** Final touch for the corners: nudge them until the printed diamonds'
 * sides fall exactly on white-inside / black-outside in the photo. */
export function fitToPrint(frame: Frame, corners: Pt[]): Pt[] {
  const lumAt = (p: Pt) => {
    const x = Math.min(frame.w - 2, Math.max(1, Math.round(p.x)));
    const y = Math.min(frame.h - 2, Math.max(1, Math.round(p.y)));
    let s = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const j = ((y + dy) * frame.w + x + dx) * 4;
        s += 0.299 * frame.data[j] + 0.587 * frame.data[j + 1] + 0.114 * frame.data[j + 2];
      }
    return s / 9;
  };
  const score = (c: Pt[]) => {
    const h = homography(MAT_CORNERS, c);
    let s = 0;
    for (const [i, o] of PRINT_SAMPLES) s += Math.min(120, Math.max(-40, lumAt(apply(h, i)) - lumAt(apply(h, o))));
    return s / PRINT_SAMPLES.length;
  };
  let best = corners.map((p) => ({ ...p }));
  let cur = score(best);
  const start = cur;
  const unit = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) / MAT_W;
  for (const step of [6, 3, 1.5, 0.75]) {
    const d = step * unit;
    let improved = true;
    for (let round = 0; improved && round < 12; round++) {
      improved = false;
      for (let k = 0; k < 4; k++)
        for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
          const trial = best.map((p, i) => (i === k ? { x: p.x + dx, y: p.y + dy } : p));
          const s = score(trial);
          if (s > cur) {
            cur = s;
            best = trial;
            improved = true;
          }
        }
    }
  }
  // Only trust it when the diamonds were clearly found.
  return cur > 25 && cur >= start ? best : corners;
}

/** Along the field's centre line, the white tip triangles are the cleanest
 * landmarks: they run from TIP to TIP_IN mat units from each end. */
const TIP = 60;
const TIP_IN = 146;

/** The ends of the field are the weak spot (bottles, cut-off corners): put
 * them where the two white tip triangles say they are. Samples the centre
 * line, finds both triangles, fits the 1-D perspective through their four
 * ends and moves the end corners to mat x = 0 and x = 824. Returns the
 * corners unchanged when the triangles aren't clearly visible. */
export function refineEnds(frame: Frame, corners: Pt[]): Pt[] {
  const h = homography(MAT_CORNERS, corners);
  const STEP = 0.5;
  const x0 = -60;
  const n = Math.round((MAT_W + 120) / STEP);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const dy of [-4, 0, 4]) {
      const p = apply(h, { x: x0 + i * STEP, y: MAT_H / 2 + dy });
      const px = Math.min(frame.w - 1, Math.max(0, Math.round(p.x)));
      const py = Math.min(frame.h - 1, Math.max(0, Math.round(p.y)));
      const j = (py * frame.w + px) * 4;
      s += 0.299 * frame.data[j] + 0.587 * frame.data[j + 1] + 0.114 * frame.data[j + 2];
    }
    lum[i] = s / 3;
  }
  // Black: the middle of the field; white: the bright end of the samples.
  const mid: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * STEP;
    if (x > 380 && x < MAT_W - 380) mid.push(lum[i]);
  }
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const black = median(mid);
  const white = sorted[Math.floor(sorted.length * 0.9)];
  if (white - black < 40) return corners;
  const cut = (black + white) / 2;
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const on = i < n && lum[i] > cut;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      runs.push([x0 + start * STEP, x0 + (i - 1) * STEP]);
      start = -1;
    }
  }
  const len = TIP_IN - TIP;
  const pick = (lo: number, hi: number) =>
    runs
      .filter(([a, b]) => b - a > len * 0.6 && b - a < len * 1.5 && (a + b) / 2 > lo && (a + b) / 2 < hi)
      .sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
  const left = pick(TIP - 30, TIP_IN + 40);
  const right = pick(MAT_W - TIP_IN - 40, MAT_W - TIP + 30);
  if (!left || !right) return corners;
  // u = (a·x + b) / (c·x + 1) through the four (true x, measured u) pairs.
  const pairs: [number, number][] = [
    [TIP, left[0]],
    [TIP_IN, left[1]],
    [MAT_W - TIP_IN, right[0]],
    [MAT_W - TIP, right[1]],
  ];
  const A: number[][] = [];
  const B: number[] = [];
  for (const [x, u] of pairs) {
    A.push([x, 1, -x * u]);
    B.push(u);
  }
  const sol = leastSquares3(A, B);
  if (!sol) return corners;
  const [a, b, c] = sol;
  const f = (x: number) => (a * x + b) / (c * x + 1);
  const worst = Math.max(...pairs.map(([x, u]) => Math.abs(f(x) - u)));
  const u0 = f(0);
  const u1 = f(MAT_W);
  if (!(worst < 6) || Math.abs(u0) > 90 || Math.abs(u1 - MAT_W) > 90) return corners;
  return [apply(h, { x: u0, y: 0 }), apply(h, { x: u1, y: 0 }), apply(h, { x: u1, y: MAT_H }), apply(h, { x: u0, y: MAT_H })];
}

/** Least squares for 3 unknowns (normal equations, Cramer's rule). */
function leastSquares3(A: number[][], B: number[]): [number, number, number] | null {
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const v = [0, 0, 0];
  for (let r = 0; r < A.length; r++)
    for (let i = 0; i < 3; i++) {
      v[i] += A[r][i] * B[r];
      for (let j = 0; j < 3; j++) M[i * 3 + j] += A[r][i] * A[r][j];
    }
  const det = (m: number[]) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const d = det(M);
  if (Math.abs(d) < 1e-12) return null;
  const col = (k: number) => M.map((x, idx) => (idx % 3 === k ? v[Math.floor(idx / 3)] : x));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

/** Mat point → photo point for a set of field corners (for overlays). */
export function toPhoto(corners: Pt[], p: Pt): Pt {
  return apply(homography(MAT_CORNERS, corners), p);
}

/** The same corners turned 180° (the other end is "left"). */
export const turned = (c: Pt[]): Pt[] => [c[2], c[3], c[0], c[1]];

/** Otsu's threshold for a 256-bin histogram. */
function otsu(hist: Float64Array): number {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    total += hist[i];
    sum += i * hist[i];
  }
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let at = 70;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      at = i;
    }
  }
  return at;
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Robust y = a x + b: least squares, refit on the closest 70% a few times. */
function fitLine(pts: [number, number][]): [number, number] {
  let keep = pts;
  let a = 0;
  let b = 0;
  for (let it = 0; it < 4; it++) {
    const n = keep.length;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const [x, y] of keep) {
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
    }
    const den = n * sxx - sx * sx || 1e-9;
    a = (n * sxy - sx * sy) / den;
    b = (sy - a * sx) / n;
    const res = pts.map(([x, y]) => Math.abs(y - (a * x + b)));
    const cut = Math.max(1.5, [...res].sort((p, q) => p - q)[Math.floor(res.length * 0.7)] * 1.5);
    keep = pts.filter((_, i) => res[i] < cut);
    if (keep.length < 3) break;
  }
  return [a, b];
}

/** 3×3 erosion (dilate = false) or dilation (dilate = true) of a 0/1 mask. */
function morph(m: Uint8Array, w: number, h: number, dilate: boolean): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let dy = -1; dy <= 1 && (dilate ? !v : v); dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          const on = xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx] === 1;
          if (dilate && on) {
            v = 1;
            break;
          }
          if (!dilate && !on) {
            v = 0;
            break;
          }
        }
      out[y * w + x] = v;
    }
  return out;
}

function largest(m: Uint8Array, w: number, h: number): number[] | null {
  const seen = new Uint8Array(m.length);
  let best: number[] | null = null;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    const comp: number[] = [];
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      comp.push(p);
      const x = p % w;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= m.length || seen[q] || !m[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (!best || comp.length > best.length) best = comp;
  }
  void h;
  return best;
}

/** Warps a photo to a WW × WH top-down RGB image (3 values per pixel).
 * Each pixel averages a small grid of photo samples, so fine print (the
 * logo, "DRINKING SINCE") doesn't turn into flickering noise. */
export function warp(frame: Frame, corners: Pt[], fast = false): Float32Array {
  return warpTo(frame, corners, WW, WH, fast);
}

/** The full-size top-down mat (one pixel per mat unit, 824 × 265): what is
 * stored as training data. */
export const FULL_W = MAT_W;
export const FULL_H = MAT_H;
export function warpFull(frame: Frame, corners: Pt[]): Float32Array {
  return warpTo(frame, corners, FULL_W, FULL_H, false);
}

function warpTo(frame: Frame, corners: Pt[], W: number, H: number, fast: boolean): Float32Array {
  const toPhoto = homography(MAT_CORNERS, corners);
  const out = new Float32Array(W * H * 3);
  const scale = W / MAT_W;
  const span = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) / W;
  const k = fast ? 1 : Math.min(4, Math.max(1, Math.round(span)));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < k; sy++)
        for (let sx = 0; sx < k; sx++) {
          const p = apply(toPhoto, { x: (x + (sx + 0.5) / k) / scale, y: (y + (sy + 0.5) / k) / scale });
          const px = Math.min(frame.w - 1, Math.max(0, Math.round(p.x)));
          const py = Math.min(frame.h - 1, Math.max(0, Math.round(p.y)));
          const i = (py * frame.w + px) * 4;
          r += frame.data[i];
          g += frame.data[i + 1];
          b += frame.data[i + 2];
        }
      const o = (y * W + x) * 3;
      const n = k * k;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  return out;
}

function luma(img: Float32Array): Float32Array {
  const out = new Float32Array(WW * WH);
  for (let p = 0; p < out.length; p++) out[p] = 0.299 * img[p * 3] + 0.587 * img[p * 3 + 1] + 0.114 * img[p * 3 + 2];
  return out;
}

/** Mean |a − b·k| after matching overall brightness. */
/** Brightness relative to the surroundings: the same under a shadow. */
function contrast(l: Float32Array): Float32Array {
  const m = boxMean(l, 6);
  const out = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) out[i] = (l[i] - m[i]) / (m[i] + 20);
  return out;
}
function cost(a: Float32Array, b: Float32Array): number {
  let c = 0;
  for (let i = 0; i < a.length; i++) c += Math.abs(a[i] - b[i]);
  return c / a.length;
}

/** Turns and fine-tunes `corners` so the photo lines up with `ref` (a warped
 * reference photo): tries both ends, then nudges each corner (½–4 px) while
 * the difference keeps dropping. */
export function align(frame: Frame, corners: Pt[], ref: Float32Array): Pt[] {
  // Compared on local contrast, so a shadow or lamp doesn't pull the fit.
  const refL = contrast(luma(ref));
  const score = (c: Pt[]) => cost(refL, contrast(luma(warp(frame, c, true))));
  let best = corners;
  let cur = score(best);
  const t = turned(corners);
  const ct = score(t);
  if (ct < cur) {
    best = t;
    cur = ct;
  }
  const px = Math.max(1, Math.hypot(best[1].x - best[0].x, best[1].y - best[0].y) / MAT_W / SCALE);
  for (const step of [4, 2, 1, 0.5]) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < 4; i++)
        for (const axis of ["x", "y"] as const)
          for (const dir of [1, -1]) {
            const c = best.map((p) => ({ ...p }));
            c[i][axis] += dir * step * px;
            const v = score(c);
            if (v < cur - 1e-3) {
              best = c;
              cur = v;
              improved = true;
            }
          }
    }
  }
  return best;
}

/** Integral-image box filter over each RGB channel, radius r. */
function box(img: Float32Array, r: number): Float32Array {
  const out = new Float32Array(img.length);
  const I = new Float64Array((WW + 1) * (WH + 1));
  for (let c = 0; c < 3; c++) {
    I.fill(0);
    for (let y = 0; y < WH; y++) {
      let row = 0;
      for (let x = 0; x < WW; x++) {
        row += img[(y * WW + x) * 3 + c];
        I[(y + 1) * (WW + 1) + x + 1] = I[y * (WW + 1) + x + 1] + row;
      }
    }
    for (let y = 0; y < WH; y++)
      for (let x = 0; x < WW; x++) {
        const x0 = Math.max(0, x - r);
        const y0 = Math.max(0, y - r);
        const x1 = Math.min(WW, x + r + 1);
        const y1 = Math.min(WH, y + r + 1);
        const s = I[y1 * (WW + 1) + x1] - I[y0 * (WW + 1) + x1] - I[y1 * (WW + 1) + x0] + I[y0 * (WW + 1) + x0];
        out[(y * WW + x) * 3 + c] = s / ((x1 - x0) * (y1 - y0));
      }
  }
  return out;
}

/** Light-independent detail: a small blur minus a wide blur. */
export function highPass(img: Float32Array): Float32Array {
  const fine = box(img, 1);
  const wide = box(img, 10);
  for (let i = 0; i < fine.length; i++) fine[i] -= wide[i];
  return fine;
}

/** Ends of the mat ignored by the comparison: the bottles stand there and,
 * being tall, look different from every angle. */
const END = Math.round(WW * 0.06);
/** The long edges of the field: black against the white sheet, so the
 * slightest misalignment lights them up. A cap there is off the zones anyway. */
const EDGE = 6;

/** Per-pixel difference between two high-passed images (summed over RGB),
 * the smallest over a 1-pixel shift (photos never line up perfectly). */
function shiftDiff(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(WW * WH).fill(Infinity);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      for (let y = 0; y < WH; y++) {
        const yy = Math.min(WH - 1, Math.max(0, y + dy));
        for (let x = END; x < WW - END; x++) {
          const xx = Math.min(WW - 1, Math.max(0, x + dx));
          const i = (y * WW + x) * 3;
          const j = (yy * WW + xx) * 3;
          const d = Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]);
          if (d < out[y * WW + x]) out[y * WW + x] = d;
        }
      }
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) if (x < END || x >= WW - END || y < EDGE || y >= WH - EDGE) out[y * WW + x] = 0;
  return out;
}

/** How busy the print is around each pixel (strongest detail within 1 px):
 * where the mat has edges and letters, a slightly-off photo differs too. */
function busyness(hp: Float32Array): Float32Array {
  const e = new Float32Array(WW * WH);
  for (let p = 0; p < e.length; p++) e[p] = Math.abs(hp[p * 3]) + Math.abs(hp[p * 3 + 1]) + Math.abs(hp[p * 3 + 2]);
  const out = new Float32Array(e.length);
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < WW && yy < WH) m = Math.max(m, e[yy * WW + xx]);
        }
      out[y * WW + x] = m;
    }
  return out;
}

/** Mean of a single-channel image over a (2r+1)² square. */
function boxMean(img: Float32Array, r: number): Float32Array {
  const I = new Float64Array((WW + 1) * (WH + 1));
  for (let y = 0; y < WH; y++) {
    let row = 0;
    for (let x = 0; x < WW; x++) {
      row += img[y * WW + x];
      I[(y + 1) * (WW + 1) + x + 1] = I[y * (WW + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(WW * WH);
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(WW, x + r + 1);
      const y1 = Math.min(WH, y + r + 1);
      out[y * WW + x] = (I[y1 * (WW + 1) + x1] - I[y0 * (WW + 1) + x1] - I[y1 * (WW + 1) + x0] + I[y0 * (WW + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    }
  return out;
}

/** A cap is ~32 mat units across: 16 warped pixels. */
const CAP_R = 6;
/** How much of the print's own detail is forgiven (misalignment). */
const BUSY = 0.6;

/** What the comparison needs from one warped photo. */
type Prepped = { hp: Float32Array; light: Float32Array; busy: Float32Array };

/** Detail (small blur minus wide blur), local brightness (the wide blur,
 * grey) and how busy the print is. */
function prep(img: Float32Array): Prepped {
  const fine = box(img, 1);
  const wide = box(img, 10);
  const light = new Float32Array(WW * WH);
  for (let i = 0; i < fine.length; i++) fine[i] -= wide[i];
  for (let p = 0; p < light.length; p++) light[p] = (wide[p * 3] + wide[p * 3 + 1] + wide[p * 3 + 2]) / 3;
  return { hp: fine, light, busy: busyness(fine) };
}

/** Cap-sized "something changed here" score between two photos.
 *  - Shadows and lamps: B's detail is first scaled by how much darker or
 *    lighter A is at that spot, so a shadow over the print doesn't count.
 *  - The difference minus what misalignment of the print could explain.
 *  - Averaged over a cap-sized square: a cap scores high whether it shows
 *    as a solid disk (on black) or only as a dark rim (on white). */
function changeScore(A: Prepped, B: Prepped): Float32Array {
  const scaled = new Float32Array(B.hp.length);
  const busyB = new Float32Array(B.busy.length);
  for (let p = 0; p < B.light.length; p++) {
    const g = Math.min(1.6, Math.max(0.3, (A.light[p] + 12) / (B.light[p] + 12)));
    scaled[p * 3] = B.hp[p * 3] * g;
    scaled[p * 3 + 1] = B.hp[p * 3 + 1] * g;
    scaled[p * 3 + 2] = B.hp[p * 3 + 2] * g;
    busyB[p] = B.busy[p] * g;
  }
  // Both ways round: the shift may hide a thin rim in whichever image it moves.
  const d = shiftDiff(A.hp, scaled);
  const r = shiftDiff(scaled, A.hp);
  for (let p = 0; p < d.length; p++) d[p] = Math.min(150, Math.max(0, Math.max(d[p], r[p]) - BUSY * Math.min(A.busy[p], busyB[p])));
  return boxMean(d, CAP_R);
}

/** A cap is a lone bump: around it (a cap-width away) the score drops off
 * in every direction. A shadow edge or a line stays high along its length,
 * a changed area stays high all round. */
function isolated(s: Float32Array, b: Blob): boolean {
  const cx = b.x * SCALE;
  const cy = b.y * SCALE;
  const v = at(s, b);
  const D = 15;
  const high: boolean[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const x = Math.round(cx + D * Math.cos(a));
    const y = Math.round(cy + D * Math.sin(a));
    high.push(x >= 0 && y >= 0 && x < WW && y < WH && s[y * WW + x] > v * 0.55);
  }
  const n = high.filter(Boolean).length;
  const line = high.some((h, k) => h && high[(k + 4) % 8]);
  return n <= 2 && !line;
}


/** Local maxima above `t`, at least a cap apart, strongest first. */
function peaks(s: Float32Array, t: number): Blob[] {
  const R = 8;
  const out: Blob[] = [];
  for (let y = 0; y < WH; y++)
    for (let x = END; x < WW - END; x++) {
      const v = s[y * WW + x];
      if (v <= t) continue;
      let top = true;
      for (let dy = -R; dy <= R && top; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= WW || yy >= WH || (dx === 0 && dy === 0)) continue;
          const w = s[yy * WW + xx];
          if (w > v || (w === v && (dy < 0 || (dy === 0 && dx < 0)))) {
            top = false;
            break;
          }
        }
      if (!top) continue;
      // Size of the bright patch around the peak tells a cap from a hand.
      let area = 0;
      for (let dy = -2 * R; dy <= 2 * R; dy++)
        for (let dx = -2 * R; dx <= 2 * R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < WW && yy < WH && s[yy * WW + xx] > t) area++;
        }
      out.push({ x: (x + 0.5) / SCALE, y: (y + 0.5) / SCALE, area: area / (SCALE * SCALE), fill: v, aspect: 1 });
    }
  return out.sort((a, b) => b.fill - a.fill);
}

const at = (s: Float32Array, b: Blob) => s[Math.min(WH - 1, Math.floor(b.y * SCALE)) * WW + Math.min(WW - 1, Math.floor(b.x * SCALE))];

/** A patch this big that changed is a hand or arm, not a cap (mat units²). */
export const HAND_MIN = 9000;
/** Version of this detector, stored with every throw it judged. */
export const DETECTOR = "cv-2026.11";

/** Compares the current photo with the empty mat and the previous photo
 * (all three already warped with `warp`). `minDiff` is the sensitivity
 * slider: lower finds fainter caps (and more false ones). */
export function detect(empty: Float32Array, prev: Float32Array, cur: Float32Array, minDiff = 45): Detection {
  const [E, P, C] = [prep(empty), prep(prev), prep(cur)];
  const t = minDiff * 0.4;
  const now = changeScore(C, E);
  const before = changeScore(P, E);
  const changed = changeScore(C, P);
  const present = peaks(now, t).filter((b) => isolated(now, b));
  // One throw moves a few caps at most (the thrown one can knock another
  // on): keep the strongest new bumps; much fainter ones are mostly shadows.
  const fresh = present.filter((b) => at(changed, b) > t * 0.7 && isolated(changed, b) && b.area < HAND_MIN);
  const top = fresh[0]?.fill ?? 0;
  const landed = fresh.filter((b) => b.fill >= top * 0.45).slice(0, 3);
  const gone = peaks(before, t).filter((b) => isolated(before, b) && at(changed, b) > t * 0.7 && at(now, b) < t * 0.6);
  let big = 0;
  for (const v of changed) if (v > t) big++;
  return {
    landed,
    gone,
    present,
    occluded: big / (SCALE * SCALE) >= HAND_MIN,
  };
}

/** The real mat (lib/mat-geometry.ts), in the same space as the camera. */
export const REAL_ZONES = FIELD_ZONES;
export const REAL_MAMAS = FIELD_MAMAS;

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
  for (const m of REAL_MAMAS) if (p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) return { id: m.id, v: "mama" };
  for (const z of REAL_ZONES) if (inPoly(p.x, p.y, z.pts)) return { id: z.id, v: z.v };
  if (p.x < 0 || p.x > MAT_W || p.y < 0 || p.y > MAT_H) return { id: "off", v: null };
  return { id: "none", v: null };
}

/* ---------- per-zone fine-tuning ---------- */

/** Nudges per zone/mama after the corners (mat units): the print never lies
 * exactly where 4 corners put it (a mat that isn't flat, a wide-angle lens).
 * Keys: "L3".."R3", "ML", "MR". */
export type ZoneFix = Record<string, { dx: number; dy: number }>;
export const FIX_IDS: string[] = [...REAL_ZONES.map((z) => z.id), ...REAL_MAMAS.map((m) => m.id)];

/** The outline of a zone or mama (mat units), with its nudge applied. */
export function fixedShape(id: string, fix?: ZoneFix | null): [number, number][] {
  const d = fix?.[id] ?? { dx: 0, dy: 0 };
  const z = REAL_ZONES.find((x) => x.id === id);
  const m = REAL_MAMAS.find((x) => x.id === id);
  const pts: [number, number][] = z ? z.pts : m ? [[m.x, m.y], [m.x + m.w, m.y], [m.x + m.w, m.y + m.h], [m.x, m.y + m.h]] : [];
  return pts.map(([x, y]) => [x + d.dx, y + d.dy]);
}

const centre = (pts: [number, number][]): Pt => ({ x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length });

/** A point seen on the camera (mat units after the corners) → where it lies
 * on the real print. Inside a nudged zone it moves exactly with that zone;
 * elsewhere the nudges fade out with distance (every zone, nudged or not,
 * pulls), so caps between zones move smoothly. */
export function unfix(p: Pt, fix?: ZoneFix | null): Pt {
  if (!fix || !Object.values(fix).some((d) => d.dx || d.dy)) return p;
  for (const id of FIX_IDS) {
    const d = fix[id];
    if (d && (d.dx || d.dy) && inPoly(p.x, p.y, fixedShape(id, fix))) return { x: p.x - d.dx, y: p.y - d.dy };
  }
  let w = 0;
  let ox = 0;
  let oy = 0;
  for (const id of FIX_IDS) {
    const d = fix[id] ?? { dx: 0, dy: 0 };
    const c = centre(fixedShape(id, fix));
    const k = 1 / ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 + 400);
    w += k;
    ox += k * d.dx;
    oy += k * d.dy;
  }
  return { x: p.x - ox / w, y: p.y - oy / w };
}

/** The shooting boxes: the cut-off corners of the field (mat units). */
export function shootingBoxes(cut = FIELD_CUT): [number, number][][] {
  return [
    [[0, 0], [cut, 0], [0, cut]],
    [[MAT_W, 0], [MAT_W - cut, 0], [MAT_W, cut]],
    [[MAT_W, MAT_H], [MAT_W - cut, MAT_H], [MAT_W, MAT_H - cut]],
    [[0, MAT_H], [cut, MAT_H], [0, MAT_H - cut]],
  ];
}
