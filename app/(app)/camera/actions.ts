/**
 * Camera live — server actions
 *
 * Start/stop a live camera session in a crew, post a judged throw, poll the
 * session (camera and viewers), correct a throw, fetch a throw's picture,
 * share the linked mat logger's game with the camera.
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
  startCameraSession,
} from "@/lib/db/camera";

type Spot = { x: number; y: number };
const spotsOk = (s: Spot[]) =>
  Array.isArray(s) && s.length <= 12 && s.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 2000 && Math.abs(p.y) < 2000);
const clean = (s: Spot[]) => s.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));

export async function startCameraSessionAction(groupId: string, share = false) {
  const userId = await requireUserId();
  if (!(await hasBeta(userId, "camera"))) throw new Error("Camera beta is off");
  return startCameraSession(userId, groupId, share === true);
}

export async function setCameraEmptyAction(sessionId: string, full: string) {
  await setCameraEmpty(await requireUserId(), sessionId, full);
}

export async function endCameraSessionAction(sessionId: string) {
  await endCameraSession(await requireUserId(), sessionId);
}

export async function addCameraThrowAction(
  sessionId: string,
  t: { n: number; spots: Spot[]; gone: Spot[]; image: string | null; full?: string | null; detector?: string },
) {
  const userId = await requireUserId();
  if (!Number.isInteger(t.n) || t.n < 1 || !spotsOk(t.spots) || !spotsOk(t.gone)) throw new Error("Bad throw");
  await addCameraThrow(userId, sessionId, { ...t, spots: clean(t.spots), gone: clean(t.gone) });
}

export async function correctCameraThrowAction(throwId: string, spots: Spot[]) {
  if (!spotsOk(spots)) throw new Error("Bad spots");
  await correctCameraThrow(await requireUserId(), throwId, clean(spots));
}

export async function getCameraStateAction(sessionId: string) {
  return getCameraState(await requireUserId(), sessionId);
}

export async function getCameraThrowImageAction(throwId: string) {
  return getCameraThrowImage(await requireUserId(), throwId);
}

export async function correctCameraThrowByNAction(sessionId: string, n: number, spots: Spot[]) {
  if (!spotsOk(spots) || !Number.isInteger(n)) throw new Error("Bad spots");
  await correctCameraThrowByN(await requireUserId(), sessionId, n, clean(spots));
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
