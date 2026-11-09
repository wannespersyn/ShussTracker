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
 * Data: camera_session, camera_throw (spots in mat units, 824 × 265).
 */
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { cameraSessions, cameraThrows, groupMembers, users } from "@/lib/db/schema";

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
  throws: CameraThrow[];
};

const isMember = async (userId: string, groupId: string) =>
  !!(await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)), columns: { userId: true } }));

async function sessionFor(userId: string, sessionId: string) {
  const s = await db.query.cameraSessions.findFirst({ where: eq(cameraSessions.id, sessionId) });
  if (!s || !(await isMember(userId, s.groupId))) throw new Error("Not found");
  return s;
}

/** Opens a session in a crew (closing the camera's earlier ones). */
export async function startCameraSession(userId: string, groupId: string): Promise<string> {
  if (!(await isMember(userId, groupId))) throw new Error("Not a member of this crew");
  await db.update(cameraSessions).set({ live: false }).where(and(eq(cameraSessions.userId, userId), eq(cameraSessions.live, true)));
  const [row] = await db.insert(cameraSessions).values({ groupId, userId }).returning();
  return row.id;
}

export async function endCameraSession(userId: string, sessionId: string) {
  await db.update(cameraSessions).set({ live: false }).where(and(eq(cameraSessions.id, sessionId), eq(cameraSessions.userId, userId)));
}

/** The camera posts a judged throw. */
export async function addCameraThrow(userId: string, sessionId: string, t: { n: number; spots: Spot[]; gone: Spot[]; image: string | null }) {
  const s = await db.query.cameraSessions.findFirst({ where: and(eq(cameraSessions.id, sessionId), eq(cameraSessions.userId, userId)) });
  if (!s) throw new Error("Not your camera");
  const image = t.image && t.image.startsWith("data:image/jpeg;base64,") && t.image.length < 120_000 ? t.image : null;
  await db
    .insert(cameraThrows)
    .values({ sessionId, n: t.n, found: t.spots, spots: t.spots, gone: t.gone, image })
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
  const [rows, cam] = await Promise.all([
    db
      .select({ id: cameraThrows.id, n: cameraThrows.n, found: cameraThrows.found, spots: cameraThrows.spots, gone: cameraThrows.gone, correctedBy: cameraThrows.correctedBy, createdAt: cameraThrows.createdAt })
      .from(cameraThrows)
      .where(eq(cameraThrows.sessionId, sessionId))
      .orderBy(desc(cameraThrows.n))
      .limit(MAX_THROWS),
    db.query.users.findFirst({ where: eq(users.id, s.userId), columns: { name: true } }),
  ]);
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
