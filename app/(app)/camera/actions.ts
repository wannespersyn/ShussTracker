/**
 * Camera live — server actions
 *
 * Start/stop a live camera session in a crew, post a judged throw, poll the
 * session (camera and viewers), correct a throw, fetch a throw's picture,
 * share the linked mat logger's game with the camera, set the zone nudges.
 */
"use server";

import { requireGroupMember, requireUserId } from "@/lib/db/authz";
import { hasBeta } from "@/lib/db/beta";
import {
  addCameraThrow,
  armCamera,
  labelCameraThrow,
  linkCameraLogger,
  unlinkCameraLogger,
  correctCameraThrow,
  correctCameraThrowByN,
  getCameraSnapshot,
  requestCameraSnapshot,
  setCameraCorners,
  setCameraEmpty,
  setCameraSnapshot,
  endCameraSession,
  getCameraState,
  getCameraThrowImage,
  getLiveCameras,
  setCameraGame,
  setCameraZoneFix,
  checkCameraThrow,
  addCameraMiss,
  startCameraSession,
  nextCameraSession,
  type FieldFix,
} from "@/lib/db/camera";

type Spot = { x: number; y: number };
const spotsOk = (s: Spot[]) =>
  Array.isArray(s) && s.length <= 12 && s.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 2000 && Math.abs(p.y) < 2000);
/** A whole field (lib/camera-field.ts): up to 16 caps (4 players × 4), or none given. */
const fieldOk = (s: Spot[] | null | undefined) => s == null || (Array.isArray(s) && s.length <= 16 && spotsOk(s.slice(0, 12)) && spotsOk(s.slice(12)));
/** A field correction: the new field and the spots caps left according to it. */
const fixOk = (f?: FieldFix) => !f || (Array.isArray(f.field) && fieldOk(f.field) && fieldOk(f.gone));
const cleanFix = (f?: FieldFix): FieldFix | undefined => (f ? { field: clean(f.field), gone: clean(f.gone) } : undefined);
const clean = (s: Spot[]) => s.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));

export async function startCameraSessionAction(groupId: string, share = false) {
  const userId = await requireUserId();
  if (!(await hasBeta(userId, "camera"))) throw new Error("Camera beta is off");
  return startCameraSession(userId, groupId, share === true);
}

export async function setCameraEmptyAction(sessionId: string, full: string) {
  await setCameraEmpty(await requireUserId(), sessionId, full);
}

/** New game on the same camera (from any phone in the crew); returns the new session. */
export async function nextCameraSessionAction(sessionId: string) {
  return nextCameraSession(await requireUserId(), sessionId);
}

export async function endCameraSessionAction(sessionId: string) {
  await endCameraSession(await requireUserId(), sessionId);
}

export async function addCameraThrowAction(
  sessionId: string,
  t: { n: number; spots: Spot[]; gone: Spot[]; field?: Spot[] | null; fieldBefore?: Spot[] | null; image: string | null; full?: string | null; detector?: string },
) {
  const userId = await requireUserId();
  if (!Number.isInteger(t.n) || t.n < 1 || !spotsOk(t.spots) || !spotsOk(t.gone) || !fieldOk(t.field) || !fieldOk(t.fieldBefore)) throw new Error("Bad throw");
  await addCameraThrow(userId, sessionId, {
    ...t,
    spots: clean(t.spots),
    gone: clean(t.gone),
    field: t.field ? clean(t.field) : null,
    fieldBefore: t.fieldBefore ? clean(t.fieldBefore) : null,
  });
}

export async function correctCameraThrowAction(throwId: string, spots: Spot[], f?: FieldFix) {
  if (!spotsOk(spots) || !fixOk(f)) throw new Error("Bad spots");
  await correctCameraThrow(await requireUserId(), throwId, clean(spots), cleanFix(f));
}

/** `gameSince`: time of the game you already have (null: you don't need it). */
export async function getCameraStateAction(sessionId: string, gameSince: number | null = 0) {
  return getCameraState(await requireUserId(), sessionId, gameSince === null ? null : Number(gameSince) || 0);
}

export async function getCameraThrowImageAction(throwId: string) {
  return getCameraThrowImage(await requireUserId(), throwId);
}

export async function correctCameraThrowByNAction(sessionId: string, n: number, spots: Spot[], f?: FieldFix) {
  if (!spotsOk(spots) || !Number.isInteger(n) || !fixOk(f)) throw new Error("Bad spots");
  await correctCameraThrowByN(await requireUserId(), sessionId, n, clean(spots), cleanFix(f));
}

export async function setCameraSnapshotAction(sessionId: string, snap: { image: string; w: number; h: number; corners: { x: number; y: number }[] }) {
  return setCameraSnapshot(await requireUserId(), sessionId, snap);
}

export async function requestCameraSnapshotAction(sessionId: string) {
  await requestCameraSnapshot(await requireUserId(), sessionId);
}

export async function setCameraCornersAction(sessionId: string, version: number, corners: { x: number; y: number }[]) {
  await setCameraCorners(await requireUserId(), sessionId, version, corners);
}

export async function getCameraSnapshotAction(sessionId: string) {
  return getCameraSnapshot(await requireUserId(), sessionId);
}

export async function linkCameraLoggerAction(sessionId: string) {
  await linkCameraLogger(await requireUserId(), sessionId);
}

export async function unlinkCameraLoggerAction(sessionId: string) {
  await unlinkCameraLogger(await requireUserId(), sessionId);
}

export async function armCameraAction(sessionId: string, armed: boolean, fresh: boolean) {
  await armCamera(await requireUserId(), sessionId, armed, fresh);
}

const SLOTS = new Set(["a1", "a2", "b1", "b2"]);
export async function labelCameraThrowAction(
  sessionId: string,
  n: number,
  label: { x: number; y: number; owner: string; no: number }[],
  how: "auto" | "confirmed" | "corrected",
) {
  if (!Number.isInteger(n) || !spotsOk(label) || !label.every((c) => SLOTS.has(c.owner) && Number.isInteger(c.no)) || !["auto", "confirmed", "corrected"].includes(how))
    throw new Error("Bad label");
  await labelCameraThrow(
    await requireUserId(),
    sessionId,
    n,
    label.map((c) => ({ ...clean([c])[0], owner: c.owner, no: c.no })),
    how,
  );
}

export async function getLiveCamerasAction(groupId: string) {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);
  return getLiveCameras(groupId);
}

/** The linked mat logger shares its game (lib/camera-log.ts CameraGame). */
export async function setCameraGameAction(sessionId: string, game: unknown) {
  const userId = await requireUserId();
  const size = JSON.stringify(game ?? null).length;
  if (!game || typeof game !== "object" || size > 400_000) throw new Error("Bad game");
  await setCameraGame(userId, sessionId, game);
}

const FIX_IDS = new Set(["L1", "L2", "L3", "R1", "R2", "R3", "ML", "MR", "SB"]);
/** Per-zone nudges (lib/camera.ts ZoneFix), from the camera or another phone. */
export async function setCameraZoneFixAction(sessionId: string, fix: Record<string, { dx: number; dy: number; s?: number }>) {
  const userId = await requireUserId();
  const ok =
    fix &&
    typeof fix === "object" &&
    Object.entries(fix).every(([k, d]) => FIX_IDS.has(k) && d && Number.isFinite(d.dx) && Number.isFinite(d.dy) && Math.abs(d.dx) < 120 && Math.abs(d.dy) < 120 && (d.s === undefined || (Number.isFinite(d.s) && d.s >= 0.5 && d.s <= (k === "SB" ? 2.5 : 1.5))));
  if (!ok) throw new Error("Bad zone fix");
  const clean = Object.fromEntries(
    Object.entries(fix).map(([k, d]) => [k, { dx: Math.round(d.dx * 10) / 10, dy: Math.round(d.dy * 10) / 10, ...(d.s !== undefined ? { s: Math.round(d.s * 100) / 100 } : {}) }]),
  );
  return setCameraZoneFix(userId, sessionId, clean);
}

/** A throw is right as the camera judged it (✓): it counts as reviewed. */
export async function checkCameraThrowAction(sessionId: string, n: number) {
  if (!Number.isInteger(n) || n < 1) throw new Error("Bad throw");
  await checkCameraThrow(await requireUserId(), sessionId, n);
}

/** "Miss": the throw went off the mat and the camera didn't see it. */
export async function addCameraMissAction(sessionId: string) {
  return addCameraMiss(await requireUserId(), sessionId);
}
