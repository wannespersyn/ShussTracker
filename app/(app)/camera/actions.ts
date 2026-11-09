/**
 * Camera live — server actions
 *
 * Start/stop a live camera session in a crew, post a judged throw, poll the
 * session (camera and viewers), correct a throw, fetch a throw's picture.
 */
"use server";

import { requireUserId } from "@/lib/db/authz";
import { hasBeta } from "@/lib/db/beta";
import {
  addCameraThrow,
  correctCameraThrow,
  correctCameraThrowByN,
  getCameraSnapshot,
  requestCameraSnapshot,
  setCameraCorners,
  setCameraSnapshot,
  endCameraSession,
  getCameraState,
  getCameraThrowImage,
  startCameraSession,
} from "@/lib/db/camera";

type Spot = { x: number; y: number };
const spotsOk = (s: Spot[]) =>
  Array.isArray(s) && s.length <= 12 && s.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 2000 && Math.abs(p.y) < 2000);
const clean = (s: Spot[]) => s.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));

export async function startCameraSessionAction(groupId: string) {
  const userId = await requireUserId();
  if (!(await hasBeta(userId, "camera"))) throw new Error("Camera beta is off");
  return startCameraSession(userId, groupId);
}

export async function endCameraSessionAction(sessionId: string) {
  await endCameraSession(await requireUserId(), sessionId);
}

export async function addCameraThrowAction(sessionId: string, t: { n: number; spots: Spot[]; gone: Spot[]; image: string | null }) {
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
