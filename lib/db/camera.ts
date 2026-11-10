/**
 * Camera live sessions — data access
 *
 * A phone fixed above the mat (the camera) opens a live session in a crew
 * and posts every throw it judged: where it found the cap and a small
 * top-down picture. Crew members follow the session from their own phone
 * and correct a throw by pointing at the real spot. The camera phone's
 * regular polling doubles as its heartbeat: a session counts as live while
 * it's open and the camera checked in recently.
 *
 * Data: camera_session, camera_throw (spots in mat units, 824 × 265),
 * camera_game (the linked mat logger's game, so the camera can show it),
 * camera_zone_fix (per-zone nudges, set on the camera or from another phone).
 */
import { put } from "@vercel/blob";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cameraGames, cameraSessions, cameraThrows, cameraZoneFixes, groupMembers, users } from "@/lib/db/schema";

/** A camera that hasn't checked in for this long is gone. */
const STALE_MS = 2 * 60 * 1000;
/** Throws sent per poll (newest first). */
const MAX_THROWS = 60;

export type Spot = { x: number; y: number };
export type CameraThrow = {
  id: string;
  n: number;
  /** Caps the camera saw land or move in this throw. */
  found: Spot[];
  /** The final list (corrected or as found). */
  spots: Spot[];
  /** Where caps were knocked away from. */
  gone: Spot[];
  corrected: boolean;
  createdAt: Date;
};
export type CameraState = {
  id: string;
  groupId: string;
  cameraUserId: string;
  cameraName: string;
  live: boolean;
  /** "calibrating" until someone confirmed the corners, then "watching". */
  phase: "calibrating" | "watching";
  snap: { version: number; w: number; h: number } | null;
  snapRequest: number;
  corners: { x: number; y: number }[] | null;
  /** Linked to a mat logger: only judge throws while armed. */
  logger: { id: string; name: string } | null;
  armed: boolean;
  armVersion: number;
  throws: CameraThrow[];
  /** The linked mat logger's game (lib/camera-log.ts CameraGame), if any. */
  game: unknown;
  /** Per-zone nudges (lib/camera.ts ZoneFix) and their version, if any. */
  zoneFix: { fix: Record<string, { dx: number; dy: number }>; version: number } | null;
};

const isMember = async (userId: string, groupId: string) =>
  !!(await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)), columns: { userId: true } }));

async function sessionFor(userId: string, sessionId: string) {
  const s = await db.query.cameraSessions.findFirst({ where: eq(cameraSessions.id, sessionId) });
  if (!s || !(await isMember(userId, s.groupId))) throw new Error("Not found");
  return s;
}

/** A JPEG data URL → Blob (public, unguessable name). Null when it isn't one
 * or Blob isn't configured. */
async function storeJpeg(path: string, dataUrl: string | null | undefined): Promise<string | null> {
  if (!dataUrl?.startsWith("data:image/jpeg;base64,") || dataUrl.length > 1_500_000 || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const body = Buffer.from(dataUrl.slice("data:image/jpeg;base64,".length), "base64");
    const blob = await put(path, body, { access: "public", contentType: "image/jpeg", addRandomSuffix: true });
    return blob.url;
  } catch {
    return null;
  }
}

/** Opens a session in a crew (closing the camera's earlier ones). `share`:
 * the owner agreed to keep top-down pictures of the mat for training. */
export async function startCameraSession(userId: string, groupId: string, share = false): Promise<string> {
  if (!(await isMember(userId, groupId))) throw new Error("Not a member of this crew");
  await db.update(cameraSessions).set({ live: false }).where(and(eq(cameraSessions.userId, userId), eq(cameraSessions.live, true)));
  const [row] = await db.insert(cameraSessions).values({ groupId, userId, shareImages: share }).returning();
  return row.id;
}

export async function endCameraSession(userId: string, sessionId: string) {
  await db.update(cameraSessions).set({ live: false }).where(and(eq(cameraSessions.id, sessionId), eq(cameraSessions.userId, userId)));
}

/** The camera posts a judged throw. */
export async function addCameraThrow(
  userId: string,
  sessionId: string,
  t: { n: number; spots: Spot[]; gone: Spot[]; image: string | null; full?: string | null; detector?: string },
) {
  const s = await db.query.cameraSessions.findFirst({ where: and(eq(cameraSessions.id, sessionId), eq(cameraSessions.userId, userId)) });
  if (!s) throw new Error("Not your camera");
  const imageUrl = s.shareImages ? await storeJpeg(`camera/${sessionId}/throw-${t.n}.jpg`, t.full) : null;
  const image = t.image && t.image.startsWith("data:image/jpeg;base64,") && t.image.length < 120_000 ? t.image : null;
  await db
    .insert(cameraThrows)
    .values({ sessionId, n: t.n, found: t.spots, spots: t.spots, gone: t.gone, image, imageUrl, detector: t.detector?.slice(0, 40) ?? null })
    .onConflictDoNothing();
  await db.update(cameraSessions).set({ updatedAt: new Date() }).where(eq(cameraSessions.id, sessionId));
}

/** Anyone in the crew (the camera too) fixes where a throw's cap lies. */
export async function correctCameraThrow(userId: string, throwId: string, spots: Spot[]) {
  const t = await db.query.cameraThrows.findFirst({ where: eq(cameraThrows.id, throwId), columns: { sessionId: true } });
  if (!t) throw new Error("Not found");
  await sessionFor(userId, t.sessionId);
  await db
    .update(cameraThrows)
    .set({ spots, correctedBy: userId })
    .where(eq(cameraThrows.id, throwId));
}

/** Same, by throw number (the camera knows its own numbers, not the ids). */
export async function correctCameraThrowByN(userId: string, sessionId: string, n: number, spots: Spot[]) {
  await sessionFor(userId, sessionId);
  await db
    .update(cameraThrows)
    .set({ spots, correctedBy: userId })
    .where(and(eq(cameraThrows.sessionId, sessionId), eq(cameraThrows.n, n)));
}

/** The session with its throws (no pictures); a poll by the camera itself
 * also counts as its heartbeat. */
export async function getCameraState(userId: string, sessionId: string): Promise<CameraState> {
  const s = await sessionFor(userId, sessionId);
  if (s.userId === userId && s.live) await db.update(cameraSessions).set({ updatedAt: new Date() }).where(eq(cameraSessions.id, sessionId));
  const [rows, cam, logger] = await Promise.all([
    db
      .select({ id: cameraThrows.id, n: cameraThrows.n, found: cameraThrows.found, spots: cameraThrows.spots, gone: cameraThrows.gone, correctedBy: cameraThrows.correctedBy, createdAt: cameraThrows.createdAt })
      .from(cameraThrows)
      .where(eq(cameraThrows.sessionId, sessionId))
      .orderBy(desc(cameraThrows.n))
      .limit(MAX_THROWS),
    db.query.users.findFirst({ where: eq(users.id, s.userId), columns: { name: true } }),
    s.loggerId ? db.query.users.findFirst({ where: eq(users.id, s.loggerId), columns: { id: true, name: true } }) : Promise.resolve(undefined),
  ]);
  const [game, zoneFix] = await Promise.all([s.loggerId ? getCameraGame(sessionId) : Promise.resolve(null), getCameraZoneFix(sessionId)]);
  return {
    id: s.id,
    groupId: s.groupId,
    cameraUserId: s.userId,
    cameraName: cam?.name ?? "?",
    live: s.live && Date.now() - s.updatedAt.getTime() < STALE_MS,
    phase: s.phase === "watching" ? "watching" : "calibrating",
    snap: s.snapVersion > 0 && s.snapW && s.snapH ? { version: s.snapVersion, w: s.snapW, h: s.snapH } : null,
    snapRequest: s.snapRequest,
    corners: s.corners ?? null,
    logger: logger ? { id: logger.id, name: logger.name ?? "?" } : null,
    armed: s.armed,
    armVersion: s.armVersion,
    game,
    zoneFix,
    throws: rows.map((r) => ({
      id: r.id,
      n: r.n,
      found: r.found,
      spots: r.spots,
      gone: r.gone,
      corrected: r.correctedBy !== null,
      createdAt: r.createdAt,
    })),
  };
}

const cornersOk = (c: unknown, w: number, h: number): c is { x: number; y: number }[] =>
  Array.isArray(c) && c.length === 4 && c.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= -w && p.x <= 2 * w && p.y >= -h && p.y <= 2 * h);

/** The camera uploads a new empty-mat snapshot with its own guess of the
 * corners; the session goes (back) to calibrating. Returns the version. */
export async function setCameraSnapshot(userId: string, sessionId: string, snap: { image: string; w: number; h: number; corners: { x: number; y: number }[] }) {
  const s = await db.query.cameraSessions.findFirst({ where: and(eq(cameraSessions.id, sessionId), eq(cameraSessions.userId, userId)) });
  if (!s) throw new Error("Not your camera");
  if (!snap.image.startsWith("data:image/jpeg;base64,") || snap.image.length > 900_000 || !cornersOk(snap.corners, snap.w, snap.h)) throw new Error("Bad snapshot");
  const version = s.snapVersion + 1;
  await db
    .update(cameraSessions)
    .set({ snapshot: snap.image, snapW: snap.w, snapH: snap.h, snapVersion: version, corners: snap.corners, phase: "calibrating", updatedAt: new Date() })
    .where(eq(cameraSessions.id, sessionId));
  return version;
}

/** Anyone in the crew asks the camera for a fresh snapshot. */
export async function requestCameraSnapshot(userId: string, sessionId: string) {
  const s = await sessionFor(userId, sessionId);
  await db.update(cameraSessions).set({ snapRequest: s.snapRequest + 1 }).where(eq(cameraSessions.id, sessionId));
}

/** Anyone in the crew (or the camera) confirms the corners for a snapshot
 * version → the camera starts watching. */
export async function setCameraCorners(userId: string, sessionId: string, version: number, corners: { x: number; y: number }[]) {
  const s = await sessionFor(userId, sessionId);
  if (s.snapVersion !== version || !s.snapW || !s.snapH || !cornersOk(corners, s.snapW, s.snapH)) throw new Error("Outdated snapshot");
  await db.update(cameraSessions).set({ corners, phase: "watching" }).where(eq(cameraSessions.id, sessionId));
}

/** The camera stores its full-size empty mat (the training reference). */
export async function setCameraEmpty(userId: string, sessionId: string, full: string) {
  const s = await db.query.cameraSessions.findFirst({ where: and(eq(cameraSessions.id, sessionId), eq(cameraSessions.userId, userId)) });
  if (!s || !s.shareImages) return;
  const url = await storeJpeg(`camera/${sessionId}/empty-v${s.snapVersion}.jpg`, full);
  if (url) await db.update(cameraSessions).set({ emptyUrl: url }).where(eq(cameraSessions.id, sessionId));
}

/** A mat logger takes the camera for its game (it becomes training data). */
export async function linkCameraLogger(userId: string, sessionId: string) {
  await sessionFor(userId, sessionId);
  await db.update(cameraSessions).set({ loggerId: userId, kind: "game", armed: false }).where(eq(cameraSessions.id, sessionId));
}

export async function unlinkCameraLogger(userId: string, sessionId: string) {
  await db
    .update(cameraSessions)
    .set({ loggerId: null, armed: false })
    .where(and(eq(cameraSessions.id, sessionId), eq(cameraSessions.loggerId, userId)));
}

/** The logger arms (a throw is expected) or disarms the camera; `fresh`
 * also tells it to start from the mat as it is now. */
export async function armCamera(userId: string, sessionId: string, armed: boolean, fresh: boolean) {
  const s = await db.query.cameraSessions.findFirst({ where: and(eq(cameraSessions.id, sessionId), eq(cameraSessions.loggerId, userId)) });
  if (!s) throw new Error("Not your game");
  await db
    .update(cameraSessions)
    .set({ armed, armVersion: fresh ? s.armVersion + 1 : s.armVersion })
    .where(eq(cameraSessions.id, sessionId));
}

/** The logger stores the confirmed mat after a camera throw (training label). */
export async function labelCameraThrow(
  userId: string,
  sessionId: string,
  n: number,
  label: { x: number; y: number; owner: string; no: number }[],
  how: "auto" | "confirmed" | "corrected",
) {
  const s = await db.query.cameraSessions.findFirst({ where: and(eq(cameraSessions.id, sessionId), eq(cameraSessions.loggerId, userId)), columns: { id: true } });
  if (!s) throw new Error("Not your game");
  await db.update(cameraThrows).set({ label, labelHow: how }).where(and(eq(cameraThrows.sessionId, sessionId), eq(cameraThrows.n, n)));
}

/** The current empty-mat snapshot. */
export async function getCameraSnapshot(userId: string, sessionId: string): Promise<string | null> {
  const s = await sessionFor(userId, sessionId);
  return s.snapshot;
}

/** One throw's picture (fetched only when someone looks at it). */
export async function getCameraThrowImage(userId: string, throwId: string): Promise<string | null> {
  const t = await db.query.cameraThrows.findFirst({ where: eq(cameraThrows.id, throwId), columns: { sessionId: true, image: true } });
  if (!t) return null;
  await sessionFor(userId, t.sessionId);
  return t.image;
}

/** Cameras live in a crew right now (for the crew page). */
export async function getLiveCameras(groupId: string): Promise<{ id: string; name: string; calibrating: boolean }[]> {
  const rows = await db
    .select({ id: cameraSessions.id, name: users.name, phase: cameraSessions.phase })
    .from(cameraSessions)
    .innerJoin(users, eq(users.id, cameraSessions.userId))
    .where(and(eq(cameraSessions.groupId, groupId), eq(cameraSessions.live, true), gt(cameraSessions.updatedAt, new Date(Date.now() - STALE_MS))))
    .orderBy(desc(cameraSessions.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.name ?? "?", calibrating: r.phase !== "watching" }));
}

/** The game of the linked logger; null when there is none (or the table isn't
 * migrated yet — the camera then just works without it). */
async function getCameraGame(sessionId: string): Promise<unknown> {
  try {
    const [row] = await db.select({ state: cameraGames.state }).from(cameraGames).where(eq(cameraGames.sessionId, sessionId)).limit(1);
    return row?.state ?? null;
  } catch {
    return null;
  }
}

/** The linked logger shares its game with the camera. */
export async function setCameraGame(userId: string, sessionId: string, state: unknown) {
  const s = await db.query.cameraSessions.findFirst({ where: and(eq(cameraSessions.id, sessionId), eq(cameraSessions.loggerId, userId)), columns: { id: true } });
  if (!s) throw new Error("Not your game");
  await db
    .insert(cameraGames)
    .values({ sessionId, state, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cameraGames.sessionId, set: { state, updatedAt: new Date() } });
}

/** The zone nudges of a session; null when none were set (or the table isn't
 * migrated yet). */
async function getCameraZoneFix(sessionId: string) {
  try {
    const [row] = await db.select({ fix: cameraZoneFixes.fix, version: cameraZoneFixes.version }).from(cameraZoneFixes).where(eq(cameraZoneFixes.sessionId, sessionId)).limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/** Anyone in the crew (the camera too) sets the zone nudges; returns the new version. */
export async function setCameraZoneFix(userId: string, sessionId: string, fix: Record<string, { dx: number; dy: number }>): Promise<number> {
  await sessionFor(userId, sessionId);
  const [row] = await db
    .insert(cameraZoneFixes)
    .values({ sessionId, fix, version: 1, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cameraZoneFixes.sessionId, set: { fix, version: sql`${cameraZoneFixes.version} + 1`, updatedAt: new Date() } })
    .returning();
  return row.version;
}
