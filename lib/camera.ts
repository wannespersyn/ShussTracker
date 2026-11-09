/**
 * Camera mat detection (beta)
 *
 * Finds caps on photos of the mat taken from above — handheld is fine:
 *  1. find the black playing field in every photo (largest dark area) and
 *     fit its four edges, ignoring the bottles at the ends → corners;
 *  2. fine-tune those corners against the reference photo (small search
 *     that minimises the pixel difference), and pick which end is which;
 *  3. warp to a small top-down image of the mat (824 × 265 mat space);
 *  4. compare high-passed images (so glare and light changes don't count),
 *     allowing a 1-pixel shift, with the bottle ends masked out;
 *  5. blobs that appeared since the previous photo = caps that landed,
 *     blobs that vanished = caps shot away, one huge blob = a hand.
 *
 * Data: raw RGBA pixels in, mat coordinates (lib/mat.ts) out. Pure JS.
 * Notes: tuned on real photos of the Leberschuss mat (black field, white
 * zones, silver caps) in a lit room.
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
  return [meet(T1, L1), meet(T1, R1), meet(B1, R1), meet(B1, L1)];
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

/** Warps a photo to a WW × WH top-down RGB image (3 bytes per pixel). */
export function warp(frame: Frame, corners: Pt[]): Float32Array {
  const toPhoto = homography(MAT_CORNERS, corners);
  const out = new Float32Array(WW * WH * 3);
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) {
      const p = apply(toPhoto, { x: (x + 0.5) / SCALE, y: (y + 0.5) / SCALE });
      const px = Math.min(frame.w - 1, Math.max(0, Math.round(p.x)));
      const py = Math.min(frame.h - 1, Math.max(0, Math.round(p.y)));
      const i = (py * frame.w + px) * 4;
      const o = (y * WW + x) * 3;
      out[o] = frame.data[i];
      out[o + 1] = frame.data[i + 1];
      out[o + 2] = frame.data[i + 2];
    }
  return out;
}

function luma(img: Float32Array): Float32Array {
  const out = new Float32Array(WW * WH);
  for (let p = 0; p < out.length; p++) out[p] = 0.299 * img[p * 3] + 0.587 * img[p * 3 + 1] + 0.114 * img[p * 3 + 2];
  return out;
}

/** Mean |a − b·k| after matching overall brightness. */
function cost(a: Float32Array, b: Float32Array): number {
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) {
    sa += a[i];
    sb += b[i];
  }
  const k = sb > 0 ? sa / sb : 1;
  let c = 0;
  for (let i = 0; i < a.length; i++) c += Math.abs(a[i] - b[i] * k);
  return c / a.length;
}

/** Turns and fine-tunes `corners` so the photo lines up with `ref` (a warped
 * reference photo): tries both ends, then nudges each corner (½–4 px) while
 * the difference keeps dropping. */
export function align(frame: Frame, corners: Pt[], ref: Float32Array): Pt[] {
  const refL = luma(ref);
  const score = (c: Pt[]) => cost(refL, luma(warp(frame, c)));
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
const END = Math.round(WW * 0.07);

/** Per-pixel difference between two high-passed images, the smallest over a
 * 1-pixel shift (photos never line up perfectly). */
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
    for (let x = 0; x < WW; x++) if (x < END || x >= WW - END) out[y * WW + x] = 0;
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
  const t = Math.max(min, mean + 4 * sd);
  const m = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) m[i] = d[i] > t ? 1 : 0;
  // Opening: drop 1-pixel specks.
  return morph(morph(m, WW, WH, false), WW, WH, true);
}

/** Connected blobs (4-neighbour) with centre in mat coordinates. */
export function blobs(m: Uint8Array): Blob[] {
  const seen = new Uint8Array(m.length);
  const out: Blob[] = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let x0 = WW;
    let x1 = 0;
    let y0 = WH;
    let y1 = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % WW;
      const y = (p - x) / WW;
      area++;
      sx += x;
      sy += y;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const q of [p - 1, p + 1, p - WW, p + WW]) {
        if (q < 0 || q >= m.length || seen[q] || !m[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === WW - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    out.push({
      x: (sx / area + 0.5) / SCALE,
      y: (sy / area + 0.5) / SCALE,
      area: area / (SCALE * SCALE),
      fill: area / (bw * bh),
      aspect: Math.max(bw, bh) / Math.min(bw, bh),
    });
  }
  return out;
}

/** A cap is ~32 mat units across (≈ 800 units²); allow for blur, shadow and
 * a partly hidden cap. */
export const CAP_MIN = 120;
export const CAP_MAX = 3500;
export const HAND_MIN = 9000;
/** Caps are round: compact blobs only (glare edges and lines are long and thin). */
const caps = (bs: Blob[]) => bs.filter((b) => b.area >= CAP_MIN && b.area <= CAP_MAX && b.aspect <= 1.8 && b.fill >= 0.45);

/** Compares the current photo with the empty mat and the previous photo
 * (all three already warped with `warp`). */
export function detect(empty: Float32Array, prev: Float32Array, cur: Float32Array, minDiff = 45): Detection {
  const [e, p, c] = [highPass(empty), highPass(prev), highPass(cur)];
  const nowMask = mask(shiftDiff(c, e), minDiff);
  const prevMask = mask(shiftDiff(p, e), minDiff);
  const changed = mask(shiftDiff(c, p), minDiff);
  const landed = new Uint8Array(nowMask.length);
  const gone = new Uint8Array(nowMask.length);
  for (let i = 0; i < nowMask.length; i++) {
    if (!changed[i]) continue;
    if (nowMask[i]) landed[i] = 1;
    else if (prevMask[i]) gone[i] = 1;
  }
  const all = blobs(nowMask);
  return {
    landed: caps(blobs(landed)),
    gone: caps(blobs(gone)),
    present: caps(all),
    occluded: blobs(changed).some((b) => b.area >= HAND_MIN),
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
