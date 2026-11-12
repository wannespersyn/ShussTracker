/**
 * Camera dataset export (camera beta → training data)
 *
 * Pulls every camera throw from the database and writes a dataset to
 * train a cap detector on: the top-down picture of the mat after each
 * throw plus every cap that lies on the field at that moment.
 *
 * Newer throws keep the whole field (`field`, lib/camera-field.ts): that is
 * the label, verified when a person ticked ✓ or corrected it. Older throws
 * only store what changed (`spots` landed/moved, `gone` knocked
 * away), so the full mat is rebuilt per round: start empty, add `spots`,
 * remove the cap nearest to each `gone`. Positions always come from the
 * camera; a mat-logger `label` (taps on the drawn mat, only zone-accurate)
 * is used as a check: every logger cap must have a camera cap nearby. Rounds come from
 * the linked mat logger (camera_game); a camera without logger falls back
 * to a pause of ROUND_GAP_S between throws.
 *
 * A picture counts as `verified` when a person vouched for the whole mat:
 * every throw of the round so far checked (✓) or corrected on a camera
 * screen, or a confirmed/corrected logger label that agrees with the camera. Verified pictures can
 * go to the test set; the rest are pre-labels to review in Label Studio.
 *
 * Usage:  npx tsx scripts/camera-model/export-dataset.ts [outDir]
 *         (reads DATABASE_URL from .env; default outDir: camera-dataset;
 *         `--from-json rows.json` reads { sessions, rows } instead, for tests)
 * Writes: <outDir>/images/*.jpg, <outDir>/frames.json,
 *         <outDir>/label-studio-tasks.json  → see scripts/camera-model/README.md
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { MAT_H, MAT_W, shootingBoxes } from "@/lib/camera";

/** A cap is ~32 mat units across (lib/camera.ts). */
const CAP_D = 32;
/** A `gone` spot takes the nearest cap within this distance (as placeFromCamera). */
const GONE_MAX = 40;
/** Two caps closer than this are one cap (the same cap reported twice). */
const SAME_CAP = 10;
/** A logger cap matches a camera cap this close (logger taps are only zone-accurate). */
const LABEL_NEAR = 70;
/** Without a logger: a pause this long between throws = the mat was cleared. */
const ROUND_GAP_S = 45;

type P = { x: number; y: number };
type Row = {
  id: string; session_id: string; n: number; spots: P[]; gone: P[];
  corrected_by: string | null; checked_by: string | null;
  label: (P & { owner: string; no: number })[] | null; label_how: string | null;
  /** Whole field after the throw (lib/camera-field.ts), and whether a person vouched for it. */
  field: P[] | null; field_how: string | null;
  image: string | null; image_url: string | null; detector: string | null; created_at: string;
};
type Session = { id: string; kind: string; group_id: string; created_at: string; state: unknown };

const args = process.argv.slice(2);
const fixtureAt = args.indexOf("--from-json");
const fixture = fixtureAt >= 0 ? args.splice(fixtureAt, 2)[1] : null;
const out = args[0] ?? "camera-dataset";
fs.mkdirSync(path.join(out, "images"), { recursive: true });

// No top-level await: the repo builds scripts as CommonJS.
async function main() {
  const { sessions, rows } = fixture ? (JSON.parse(fs.readFileSync(fixture, "utf8")) as { sessions: Session[]; rows: Row[] }) : await load();

  /** Sessions (with the linked logger's game) and all throws, from the database. */
  async function load() {
    if (fs.existsSync(".env")) process.loadEnvFile(".env");
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL missing (.env)");
    const sql = neon(url);
    const sessions = (await sql`
      select s.id, s.kind, s.group_id, s.created_at, g.state
      from camera_session s left join camera_game g on g.session_id = s.id
      order by s.created_at`) as Session[];
    const rows = (await sql`
      select id, session_id, n, spots, gone, corrected_by, checked_by, label, label_how, field, field_how,
             image, image_url, detector, created_at
      from camera_throw order by session_id, n`) as Row[];
    return { sessions, rows };
  }

  /** Round per camera throw number, from the logger's game (links → throw → round). */
  function loggerRounds(state: unknown): Map<number, number> | null {
    const g = state as { st?: { throws?: { round: number }[] }; links?: Record<string, number> } | null;
    if (!g?.st?.throws || !g.links) return null;
    const m = new Map<number, number>();
    for (const [n, i] of Object.entries(g.links)) {
      const r = g.st.throws[i]?.round;
      if (r) m.set(Number(n), r);
    }
    return m.size ? m : null;
  }

  const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
  const onMat = (p: P) => p.x >= 0 && p.y >= 0 && p.x <= MAT_W && p.y <= MAT_H;

  async function imageBytes(r: Row): Promise<{ buf: Buffer; full: boolean } | null> {
    if (r.image_url) {
      try {
        const res = await fetch(r.image_url);
        if (res.ok) return { buf: Buffer.from(await res.arrayBuffer()), full: true };
      } catch {
        // fall back to the small picture
      }
    }
    const pre = "data:image/jpeg;base64,";
    return r.image?.startsWith(pre) ? { buf: Buffer.from(r.image.slice(pre.length), "base64"), full: false } : null;
  }

  type Frame = {
    file: string; session: string; kind: string; n: number; round: number; roundFrom: "logger" | "gap";
    /** Picture size: 824 × 265 (Blob, one pixel per mat unit) or 412 × 133 (small). */
    w: number; h: number;
    /** Every cap on the field after the throw, in mat units (824 × 265). */
    caps: P[];
    /** field = the camera's whole field (newer throws); rebuilt = camera only; agree/mismatch = the logger's label matched the camera's caps or not. */
  source: "field" | "rebuilt" | "agree" | "mismatch"; labelHow: string | null; verified: boolean;
    /** This throw itself was checked/corrected by a person. */
    reviewed: boolean; detector: string | null; createdAt: string;
  };
  const frames: Frame[] = [];
  const stats = { throws: 0, noImage: 0 };

  for (const s of sessions) {
    const throws = rows.filter((r) => r.session_id === s.id);
    const fromLogger = loggerRounds(s.state);
    let mat: P[] = [];
    let round = 0;
    let roundOk = true; // every throw of this round so far vouched for by a person
    let prev: Row | null = null;
    let lastRound = 1;
    for (const r of throws) {
      stats.throws++;
      // Which round: the logger knows; otherwise a long pause = new round.
      let rnd: number;
      if (fromLogger) rnd = fromLogger.get(r.n) ?? lastRound;
      else rnd = !prev ? 1 : round + ((new Date(r.created_at).getTime() - new Date(prev.created_at).getTime()) / 1000 > ROUND_GAP_S ? 1 : 0);
      if (rnd !== round) {
        mat = [];
        roundOk = true;
        round = rnd;
      }
      lastRound = rnd;
      prev = r;

      const reviewed = !!r.corrected_by || !!r.checked_by || r.label_how === "corrected" || r.label_how === "confirmed";
      // Positions always come from the camera: spots are taps on the photo,
      // so they're precise. Rebuild the mat: knocked caps out, landed caps in.
      for (const g of r.gone ?? []) {
        let best = -1;
        let bd = GONE_MAX;
        mat.forEach((c, i) => {
          const d = dist(c, g);
          if (d < bd) [bd, best] = [d, i];
        });
        if (best >= 0) mat.splice(best, 1);
      }
      for (const p of r.spots ?? []) if (onMat(p) && !mat.some((c) => dist(c, p) < SAME_CAP)) mat.push({ x: p.x, y: p.y });
      const camOk: boolean = roundOk && reviewed;

      // A mat-logger label (taps on the drawn mat, only zone-accurate) is a
      // check: does every cap the logger has match a camera cap nearby?
      let source: Frame["source"] = "rebuilt";
      let caps = mat;
      let verified: boolean = camOk;
      if (r.field) {
        // The camera kept the whole field: a ✓ or a correction vouched for all of it.
        mat = r.field.filter(onMat).map(({ x, y }) => ({ x, y }));
        caps = mat;
        source = "field";
        verified = r.field_how === "checked" || r.field_how === "corrected";
      } else if (r.label) {
        const free = [...mat];
        const extra: P[] = [];
        // Missed caps sit off the mat in the logger.
        for (const l of r.label.filter(onMat)) {
          let best = -1;
          let bd = LABEL_NEAR;
          free.forEach((c, i) => {
            const d = dist(c, l);
            if (d < bd) [bd, best] = [d, i];
          });
          if (best >= 0) free.splice(best, 1);
          else extra.push({ x: l.x, y: l.y });
        }
        const agree = !extra.length && !free.length;
        source = agree ? "agree" : "mismatch";
        // Mismatch: keep the logger's extra caps as a rough pre-label to fix in review.
        if (!agree) caps = [...mat, ...extra];
        verified = agree && (camOk || r.label_how === "corrected" || r.label_how === "confirmed");
      }
      roundOk = verified;

      const img = await imageBytes(r);
      if (!img) {
        stats.noImage++;
        continue;
      }
      const file = `${s.id.slice(0, 8)}-${String(r.n).padStart(3, "0")}.jpg`;
      fs.writeFileSync(path.join(out, "images", file), img.buf);
      frames.push({
        file, session: s.id, kind: s.kind, n: r.n, round, roundFrom: fromLogger ? "logger" : "gap",
        w: img.full ? MAT_W : Math.round(MAT_W / 2), h: img.full ? MAT_H : Math.round(MAT_H / 2),
        caps: caps.map((c) => ({ ...c })), source, labelHow: r.label_how, verified,
        reviewed, detector: r.detector, createdAt: r.created_at,
      });
    }
  }

  const meta = {
    exportedAt: new Date().toISOString(),
    matUnits: { w: MAT_W, h: MAT_H },
    capDiameter: CAP_D,
    /** Shooting boxes (mat units): caps waiting there aren't labelled, so they're masked out. */
    shootingBoxes: shootingBoxes(null),
  };
  fs.writeFileSync(path.join(out, "frames.json"), JSON.stringify({ meta, frames }, null, 1));

  // Label Studio: one task per picture, the rebuilt mat as pre-annotation.
  const pct = (v: number, of: number) => (v / of) * 100;
  const tasks = frames.map((f) => ({
    data: { image: `/data/local-files/?d=images/${f.file}`, file: f.file, verified: f.verified },
    predictions: [{
      model_version: f.source,
      result: f.caps.map((c, i) => ({
        id: `${f.file}-${i}`, from_name: "label", to_name: "image", type: "rectanglelabels",
        original_width: f.w, original_height: f.h,
        value: {
          x: pct(c.x - CAP_D / 2, MAT_W), y: pct(c.y - CAP_D / 2, MAT_H),
          width: pct(CAP_D, MAT_W), height: pct(CAP_D, MAT_H), rotation: 0, rectanglelabels: ["dop"],
        },
      })),
    }],
  }));
  fs.writeFileSync(path.join(out, "label-studio-tasks.json"), JSON.stringify(tasks));

  const count = (fn: (f: Frame) => boolean) => frames.filter(fn).length;
  console.log(`${stats.throws} throws → ${frames.length} pictures in ${out}/ (${stats.noImage} without picture)`);
  console.log(`  game: ${count((f) => f.kind === "game")}, test: ${count((f) => f.kind === "test")}`);
  console.log(`  verified (whole mat checked): ${count((f) => f.verified)} — of which whole-field throws: ${count((f) => f.source === "field" && f.verified)}/${count((f) => f.source === "field")}`);
  console.log(`  logger label vs camera: ${count((f) => f.source === "agree")} agree, ${count((f) => f.source === "mismatch")} differ (review those first)`);
  console.log(`  full size (Blob): ${count((f) => f.w === MAT_W)}, caps in total: ${frames.reduce((a, f) => a + f.caps.length, 0)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
