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
  endCameraSession,
  getCameraState,
  getCameraThrowImage,
  startCameraSession,
} from "@/lib/db/camera";

const spotOk = (s: { x: number; y: number } | null) => s === null || (Number.isFinite(s.x) && Number.isFinite(s.y) && Math.abs(s.x) < 2000 && Math.abs(s.y) < 2000);

export async function startCameraSessionAction(groupId: string) {
  const userId = await requireUserId();
  if (!(await hasBeta(userId, "camera"))) throw new Error("Camera beta is off");
  return startCameraSession(userId, groupId);
}

export async function endCameraSessionAction(sessionId: string) {
  await endCameraSession(await requireUserId(), sessionId);
}

export async function addCameraThrowAction(sessionId: string, t: { n: number; x: number | null; y: number | null; image: string | null }) {
  const userId = await requireUserId();
  if (!Number.isInteger(t.n) || t.n < 1 || !spotOk(t.x === null || t.y === null ? null : { x: t.x, y: t.y })) throw new Error("Bad throw");
  await addCameraThrow(userId, sessionId, t);
}

export async function correctCameraThrowAction(throwId: string, spot: { x: number; y: number } | null) {
  if (!spotOk(spot)) throw new Error("Bad spot");
  await correctCameraThrow(await requireUserId(), throwId, spot);
}

export async function getCameraStateAction(sessionId: string) {
  return getCameraState(await requireUserId(), sessionId);
}

export async function getCameraThrowImageAction(throwId: string) {
  return getCameraThrowImage(await requireUserId(), throwId);
}

export async function correctCameraThrowByNAction(sessionId: string, n: number, spot: { x: number; y: number } | null) {
  if (!spotOk(spot) || !Number.isInteger(n)) throw new Error("Bad spot");
  await correctCameraThrowByN(await requireUserId(), sessionId, n, spot);
}
