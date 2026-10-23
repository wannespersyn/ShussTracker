/**
 * Mat logger engine (beta): the Leberschuss mat geometry, the turn rules and
 * the round settlement, as pure functions over a plain state object. Shared by
 * the MatLogger component (client) and the game-saving code (server types).
 *
 * Coordinates are landscape mat space (824 × 265, same geometry as the mama
 * animation); the component draws it rotated upright. Corners are named as seen
 * with the mat upright on a phone (TL = top-left).
 */

export type Slot = "a1" | "a2" | "b1" | "b2";
export type Corner = "TL" | "TR" | "BL" | "BR";
type Pt = [number, number];

export const ZONES: { id: string; v: number; pts: Pt[] }[] = [
  { id: "L3", v: 3, pts: [[95, 131], [175, 100], [175, 163]] },
  { id: "L2", v: 2, pts: [[182, 96], [255, 70], [255, 195], [182, 167]] },
  { id: "L1", v: 1, pts: [[262, 66], [344, 34], [401, 131], [344, 229], [262, 197]] },
  { id: "R1", v: 1, pts: [[423, 131], [480, 34], [562, 66], [562, 197], [480, 229]] },
  { id: "R2", v: 2, pts: [[569, 70], [642, 96], [642, 167], [569, 195]] },
  { id: "R3", v: 3, pts: [[649, 100], [729, 131], [649, 163]] },
];
export const MAMAS = [
  { id: "ML", x: 40, y: 94, w: 40, h: 77 },
  { id: "MR", x: 744, y: 94, w: 40, h: 77 },
];
/** Shooting boxes are the four gold corners; each player's cap waits on the spot in their corner. */
export const CORNERS: Record<Corner, { end: "T" | "B"; pts: Pt[]; start: { x: number; y: number } }> = {
  TL: { end: "T", pts: [[28, 255], [92, 255], [28, 191]], start: { x: 56, y: 227 } },
  TR: { end: "T", pts: [[28, 10], [92, 10], [28, 74]], start: { x: 56, y: 38 } },
  BL: { end: "B", pts: [[796, 255], [732, 255], [796, 191]], start: { x: 768, y: 227 } },
  BR: { end: "B", pts: [[796, 10], [732, 10], [796, 74]], start: { x: 768, y: 38 } },
};
/** The four brown circles are bottles: a cap can't come to rest on one. */
export const BOTTLES: Pt[] = [[76, 101], [76, 166], [748, 101], [748, 166]];
export const BOTTLE_CLEAR = 37;

/** Only A1's corner is chosen: A2 sits beside A1, B1 diagonally across from A1
 * and B2 diagonally across from A2 (every throw goes diagonally over the mat). */
const SIDE: Record<Corner, Corner> = { TL: "TR", TR: "TL", BL: "BR", BR: "BL" };
const DIAG: Record<Corner, Corner> = { TL: "BR", TR: "BL", BL: "TR", BR: "TL" };
export function lineupFrom(a1: Corner, solo: boolean): Partial<Record<Slot, Corner>> {
  if (solo) return { a1, b1: DIAG[a1] };
  return { a1, a2: SIDE[a1], b1: DIAG[a1], b2: DIAG[SIDE[a1]] };
}

export type Cap = { no: number; owner: Slot; x: number; y: number; waiting: boolean; round: number };
export type Spot =
  | { kind: "waiting" }
  | { kind: "box"; slot: Slot }
  | { kind: "mama"; id: string }
  | { kind: "zone"; id: string; v: number }
  | { kind: "off" }
  | { kind: "none" };

export type MoveRec = { capNo: number; owner: Slot; isThrownCap: boolean; from: { x: number; y: number; spot: string }; to: { x: number; y: number; spot: string; countsFor: number | null } };
export type ThrowRec = { round: number; slot: Slot; kind: "normal" | "bonus" | "skipped"; skipReason: "cap_knocked" | "box_empty" | null; capNo: number | null; box: Slot | null; firstSpot: string | null; missed: boolean; moves: MoveRec[] };
export type RoundResult = { round: number; sips: number[]; mamaTeams: number[] };

export type MatState = {
  solo: boolean;
  order: Slot[];
  corner: Partial<Record<Slot, Corner>>;
  round: number;
  caps: Cap[];
  throws: ThrowRec[];
  results: RoundResult[];
  phase: "throw" | "done";
  thrower: Slot | null;
  activeCap: number | null;
  turnStart: { no: number; x: number; y: number; waiting: boolean }[];
  nextCap: number;
};

export const teamOfSlot = (s: Slot) => (s[0] === "a" ? 0 : 1);
const startOf = (st: MatState, s: Slot) => CORNERS[st.corner[s]!].start;
const teamEnd = (st: MatState, ti: number) => CORNERS[st.corner[ti === 0 ? "a1" : "b1"]!].end;
/** The 3 zones at a team's own end count for the other team; the mama at your own end is yours. */
export const zoneTeam = (st: MatState, id: string) => ((teamEnd(st, 0) === (id[0] === "L" ? "T" : "B")) ? 1 : 0);
export const mamaTeam = (st: MatState, id: string) => ((teamEnd(st, 0) === (id === "ML" ? "T" : "B")) ? 0 : 1);
const missSpot = (st: MatState, ti: number) => (teamEnd(st, ti) === "T" ? { x: 4, y: 132 } : { x: 820, y: 132 });

function inPoly(x: number, y: number, pts: Pt[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function spotOf(st: MatState, c: { x: number; y: number; waiting: boolean }): Spot {
  if (c.waiting) return { kind: "waiting" };
  for (const s of st.order) if (inPoly(c.x, c.y, CORNERS[st.corner[s]!].pts)) return { kind: "box", slot: s };
  for (const m of MAMAS) if (c.x >= m.x && c.x <= m.x + m.w && c.y >= m.y && c.y <= m.y + m.h) return { kind: "mama", id: m.id };
  for (const z of ZONES) if (inPoly(c.x, c.y, z.pts)) return { kind: "zone", id: z.id, v: z.v };
  if (c.x < 28 || c.x > 796 || c.y < 10 || c.y > 255) return { kind: "off" };
  return { kind: "none" };
}
/** Spot as stored: "L2", "MR", "box:a1", "waiting", "off", "none". */
export const spotCode = (s: Spot) => (s.kind === "zone" || s.kind === "mama" ? s.id : s.kind === "box" ? `box:${s.slot}` : s.kind);
export const countsFor = (st: MatState, s: Spot) => (s.kind === "zone" ? zoneTeam(st, s.id) : s.kind === "mama" ? mamaTeam(st, s.id) : null);

export function newMatState(solo: boolean, a1: Corner = "TR"): MatState {
  const st: MatState = {
    solo,
    order: solo ? ["a1", "b1"] : ["a1", "b1", "a2", "b2"],
    corner: lineupFrom(a1, solo),
    round: 1,
    caps: [],
    throws: [],
    results: [],
    phase: "throw",
    thrower: null,
    activeCap: null,
    turnStart: [],
    nextCap: 1,
  };
  spawnRound(st);
  startTurn(st);
  return st;
}

export function turnInfo(st: MatState) {
  const th = st.throws.filter((t) => t.round === st.round);
  const count = {} as Record<Slot, number>, allowed = {} as Record<Slot, number>;
  for (const p of st.order) { count[p] = 0; allowed[p] = 1; }
  for (const t of th) { count[t.slot]++; if (t.box) allowed[t.box]++; }
  let next: Slot | null = st.order.find((p) => count[p] === 0) ?? null;
  if (!next) {
    const used: Partial<Record<Slot, number>> = {};
    for (const t of th) if (t.box) { used[t.box] = (used[t.box] ?? 0) + 1; if (count[t.box] - 1 < used[t.box]!) { next = t.box; break; } }
  }
  return { count, allowed, next };
}

/** Every cap waits on its corner spot from the start of the round, so it can be shot away early. */
function spawnRound(st: MatState) {
  for (const p of st.order) st.caps.push({ no: st.nextCap++, owner: p, ...startOf(st, p), waiting: true, round: st.round });
}

const snapTurn = (st: MatState) => { st.turnStart = st.caps.map((c) => ({ no: c.no, x: c.x, y: c.y, waiting: c.waiting })); };
const skip = (st: MatState, slot: Slot, reason: "cap_knocked" | "box_empty") =>
  st.throws.push({ round: st.round, slot, kind: "skipped", skipReason: reason, capNo: null, box: null, firstSpot: null, missed: false, moves: [] });

function startTurn(st: MatState) {
  for (;;) {
    const { next, count } = turnInfo(st);
    if (!next) {
      st.phase = "done"; st.thrower = null; st.activeCap = null;
      st.results.push(settle(st));
      return;
    }
    st.phase = "throw";
    if (count[next] >= 1) {
      // Extra throw, always last: they flick the cap lying in their shooting box. Gone? Turn skipped.
      const inBox = st.caps.find((c) => { const s = spotOf(st, c); return s.kind === "box" && s.slot === next; });
      if (!inBox) { skip(st, next, "box_empty"); continue; }
      Object.assign(inBox, { owner: next, ...startOf(st, next), waiting: true });
      st.activeCap = inBox.no;
    } else {
      const waiting = st.caps.find((c) => c.waiting && c.owner === next && c.round === st.round);
      if (!waiting) { skip(st, next, "cap_knocked"); continue; }
      st.activeCap = waiting.no;
    }
    st.thrower = next;
    snapTurn(st);
    return;
  }
}

/** Drinking for the round: each cap in a zone gives that zone's team its value in sips;
 * a cap in a mama makes that team empty their pints and nobody sips. */
export function settle(st: MatState): RoundResult {
  const mamas = new Set<number>(), sips = [0, 0];
  for (const c of st.caps) {
    const s = spotOf(st, c);
    if (s.kind === "mama") mamas.add(mamaTeam(st, s.id));
    if (s.kind === "zone") sips[zoneTeam(st, s.id)] += s.v;
  }
  return mamas.size ? { round: st.round, sips: [0, 0], mamaTeams: [...mamas].sort() } : { round: st.round, sips, mamaTeams: [] };
}

/** Commit the current throw. Returns false when the thrown cap wasn't placed yet. */
export function finishThrow(st: MatState, miss: boolean): boolean {
  const p = st.thrower!;
  const mine = st.caps.find((c) => c.no === st.activeCap)!;
  if (!miss && mine.waiting) return false;
  const bonus = turnInfo(st).count[p] >= 1;
  if (miss) Object.assign(mine, missSpot(st, teamOfSlot(p)), { waiting: false });
  const moves: MoveRec[] = [];
  for (const c of st.caps) {
    const before = st.turnStart.find((x) => x.no === c.no);
    if (!before || (before.x === c.x && before.y === c.y && before.waiting === c.waiting)) continue;
    const to = spotOf(st, c);
    moves.push({
      capNo: c.no,
      owner: c.owner,
      isThrownCap: c.no === mine.no,
      from: { x: before.x, y: before.y, spot: spotCode(spotOf(st, before)) },
      to: { x: c.x, y: c.y, spot: c.no === mine.no && miss ? "miss" : spotCode(to), countsFor: countsFor(st, to) },
    });
  }
  const first = spotOf(st, mine);
  st.throws.push({
    round: st.round, slot: p, kind: bonus ? "bonus" : "normal", skipReason: null, capNo: mine.no,
    box: first.kind === "box" ? first.slot : null, firstSpot: miss ? "miss" : spotCode(first), missed: miss, moves,
  });
  startTurn(st);
  return true;
}

export function nextRound(st: MatState) {
  st.round++;
  st.caps = [];
  spawnRound(st);
  startTurn(st);
}

export function placeA1(st: MatState, a1: Corner) {
  st.corner = lineupFrom(a1, st.solo);
  for (const c of st.caps) if (c.waiting) Object.assign(c, startOf(st, c.owner));
  snapTurn(st);
}

/** Drop handling: back near where it was at turn start → snaps home untouched;
 * on a bottle → pushed just clear of it. */
export function dropCap(st: MatState, no: number) {
  const c = st.caps.find((x) => x.no === no);
  if (!c) return;
  const before = st.turnStart.find((x) => x.no === no);
  if (before && Math.hypot(c.x - before.x, c.y - before.y) < 26) { Object.assign(c, { x: before.x, y: before.y, waiting: before.waiting }); return; }
  for (const [px, py] of BOTTLES) {
    const d = Math.hypot(c.x - px, c.y - py);
    if (d < BOTTLE_CLEAR) {
      const ux = d ? (c.x - px) / d : 1, uy = d ? (c.y - py) / d : 0;
      c.x = Math.round(px + ux * BOTTLE_CLEAR); c.y = Math.round(py + uy * BOTTLE_CLEAR);
    }
  }
}

/* ---------- what gets saved ---------- */

export type MatMoveLog = { capNo: number; ownerId: string; isThrownCap: boolean; fromX: number; fromY: number; fromSpot: string; toX: number; toY: number; toSpot: string; toCountsForTeam: number | null };
export type MatThrowLog = { seq: number; playerId: string; slot: Slot; kind: ThrowRec["kind"]; skipReason: ThrowRec["skipReason"]; capNo: number | null; moves: MatMoveLog[] };
export type MatRoundLog = { number: number; complete: boolean; teams: { sips: number; mama: boolean }[]; throws: MatThrowLog[] };
export type MatGameLog = { a1Corner: Corner; endedBy: "pints_empty"; winnerTeam: number; rounds: MatRoundLog[] };

/** Field hit for the classic `shot` row of a throw (first landing of the thrown cap). */
export function fieldHitOf(t: ThrowRec): "1" | "2" | "3" | "mama" | "miss" | null {
  if (t.kind === "skipped" || !t.firstSpot) return null;
  const z = ZONES.find((x) => x.id === t.firstSpot);
  if (z) return String(z.v) as "1" | "2" | "3";
  if (t.firstSpot === "ML" || t.firstSpot === "MR") return "mama";
  return "miss";
}

export function toGameLog(st: MatState, players: Record<Slot, string | undefined>, winnerTeam: number): MatGameLog {
  const rounds: MatRoundLog[] = [];
  const last = st.round;
  for (let r = 1; r <= last; r++) {
    const res = st.results.find((x) => x.round === r) ?? (r === last ? settle(st) : null);
    const throws = st.throws.filter((t) => t.round === r);
    if (!throws.length && r === last && !st.results.find((x) => x.round === r)) continue;
    rounds.push({
      number: r,
      complete: Boolean(st.results.find((x) => x.round === r)),
      teams: [0, 1].map((ti) => ({ sips: res?.sips[ti] ?? 0, mama: res?.mamaTeams.includes(ti) ?? false })),
      throws: throws.map((t, i) => ({
        seq: i + 1,
        playerId: players[t.slot]!,
        slot: t.slot,
        kind: t.kind,
        skipReason: t.skipReason,
        capNo: t.capNo,
        moves: t.moves.map((m) => ({
          capNo: m.capNo, ownerId: players[m.owner]!, isThrownCap: m.isThrownCap,
          fromX: m.from.x, fromY: m.from.y, fromSpot: m.from.spot,
          toX: m.to.x, toY: m.to.y, toSpot: m.to.spot, toCountsForTeam: m.to.countsFor,
        })),
      })),
    });
  }
  const a1Corner = st.corner.a1!;
  return { a1Corner, endedBy: "pints_empty", winnerTeam, rounds };
}
