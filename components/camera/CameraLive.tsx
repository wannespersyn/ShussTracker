/**
 * CameraLive
 *
 * Beta: live shot tracking with the phone fixed above the mat (a stand or a
 * clamp). One calibration on the empty mat — on this phone, or from any
 * phone/laptop in the crew so the camera never has to be touched — then the
 * camera keeps watching:
 *  - every ~0.3 s a frame is warped top-down and cut into small cells;
 *    cells changing between frames = movement (a hand, a cap in flight);
 *  - when the picture is still but differs from the last judged picture
 *    (a cap landed, one got shot away) for ~1 s, the throw is judged against
 *    the empty mat and the previous picture (lib/camera detect);
 *  - the player sees "Cap in zone 2?" and does nothing when it's right; a
 *    tap on "Wrong" lets them point at the real spot on the mat (or say
 *    there was no cap). Corrections are kept with the throw, so they can
 *    later become training data.
 * Calibration: the 4 corners (tips of the shooting boxes; tap the photo or
 * nudge), then optionally each zone and mama on its own (ZoneEditor); the
 * zone nudges are kept on this phone and applied to every cap found.
 * Next to the throws, a log shows what the code sees and decides (paused,
 * new round, mat being cleared, light changed, each judged throw) and, with
 * a linked mat logger, what the game made of it, plus stats (CameraLog).
 * Misses: the shooting boxes are watched on their own (the cap waits there
 * before it's thrown). When the thrower's box empties and nothing lands on
 * the mat within ~2 s, the camera posts an empty throw = a miss.
 * After a new round starts, the camera first waits until the mat is clear
 * (only the shooting boxes may hold caps); caps disappearing while the mat
 * is cleared are never a throw.
 * The session is shared with a crew: every judged throw (spot + a small
 * top-down picture) is posted, crew members follow and correct it from
 * their own phone (CameraViewer, linked from the crew page), and their
 * corrections come back here through polling.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BOX_OF_CORNER, DETECTOR, FULL_H, FULL_W, MAT_W, WH, WW, align, detect, findField, inBox, unfix, warp, warpFull, type Frame, type Pt, type ZoneFix } from "@/lib/camera";
import { ZoneEditor } from "@/components/camera/ZoneEditor";
import { CornerEditor, Overlay, defaultCorners, type Photo } from "@/components/camera/CameraLab";
import { ReviewBadge, SpotsEditor, spotsLabel, warpedToJpeg, type Spot } from "@/components/camera/MatPick";
import { CameraLog, useGameText, type CamEvent } from "@/components/camera/CameraLog";
import { asCameraGame, boxLabelsOf, stampEvents, type CameraGame } from "@/lib/camera-log";
import {
  addCameraThrowAction,
  correctCameraThrowByNAction,
  endCameraSessionAction,
  getCameraStateAction,
  setCameraCornersAction,
  setCameraEmptyAction,
  setCameraSnapshotAction,
  setCameraZoneFixAction,
  checkCameraThrowAction,
  startCameraSessionAction,
} from "@/app/(app)/camera/actions";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

/** Frames are grabbed at most this big (long side). */
const MAX_SIDE = 1280;
/** How often the camera is looked at (ms). */
const TICK = 300;
/** Cells (4 × 4 warped pixels ≈ 8 mat units) and how much one has to
 * change (0–255) to count: between two frames = movement, against the last
 * judged picture = something on the mat changed. A cap covers ~4 × 4 cells. */
const CELL = 4;
const MOTION_CELL = 24;
const CHANGE_CELL = 14;
const MIN_CELLS = 2;
/** More than this share of cells changed at once while still = the light
 * changed (lamp, curtain), not a throw: start over from this picture. */
const LIGHT_SHARE = 0.3;
/** Still ticks in a row before a throw is judged (~1 s). */
const SETTLE = 3;
/** Seconds a "cap in zone X?" question stays before it counts as right. */
const CONFIRM_S = 6;

type Phase = "start" | "calibrate" | "live";
type Status = "waiting" | "moving" | "looking" | "paused" | "clearing";
/** Zone nudges are kept per phone (the camera stays in the same place). */
const FIX_KEY = "shuss.camera.zoneFix";
function loadFix(): ZoneFix {
  try {
    const v = JSON.parse(localStorage.getItem(FIX_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
/** Camera events kept for the log. */
const MAX_EVENTS = 150;
type Throw = { n: number; spots: Spot[]; gone: Spot[]; corrected: boolean; checked?: boolean; img: string | null };
/** How often the session is synced with the crew (ms). */
const SYNC = 1500;

/** Small grey copy of a warped frame (one value per cell). */
function tiny(w: Float32Array): Float32Array {
  const S = CELL;
  const tw = Math.floor(WW / S);
  const th = Math.floor(WH / S);
  const out = new Float32Array(tw * th);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      let s = 0;
      for (let dy = 0; dy < S; dy++)
        for (let dx = 0; dx < S; dx++) {
          const p = ((y * S + dy) * WW + x * S + dx) * 3;
          s += w[p] + w[p + 1] + w[p + 2];
        }
      out[y * tw + x] = s / (3 * S * S);
    }
  return out;
}

/** Cells that changed by more than `t`, ignoring the bottle ends and the
 * outer rows (those flicker with every tiny shake). */
function changed(a: Float32Array, b: Float32Array, t: number): number {
  const tw = Math.floor(WW / CELL);
  const th = Math.floor(WH / CELL);
  const end = Math.round(tw * 0.06);
  let n = 0;
  for (let y = 1; y < th - 1; y++)
    for (let x = end; x < tw - end; x++) if (Math.abs(a[y * tw + x] - b[y * tw + x]) > t) n++;
  return n;
}
const CELLS = (Math.floor(WH / CELL) - 2) * (Math.floor(WW / CELL) - 2 * Math.round(Math.floor(WW / CELL) * 0.06));
/** A shooting box holds a cap when this many of its cells differ from the empty mat. */
const BOX_CELL = 20;
const BOX_MIN = 2;
/** Readings in a row before a box counts as filled or emptied (no flicker). */
const BOX_STEADY = 2;
/** A cap left its box and nothing landed for this long = a miss (ms). */
const MISS_MS = 2000;

/** Cells (indexes into `tiny`) inside each shooting box. */
function boxCells(fix: ZoneFix): number[][] {
  const tw = Math.floor(WW / CELL);
  const th = Math.floor(WH / CELL);
  const k = MAT_W / WW;
  const out: number[][] = [[], [], [], []];
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const p = { x: (x + 0.5) * CELL * k, y: (y + 0.5) * CELL * k };
      for (let i = 0; i < 4; i++) if (inBox(p, i, fix)) out[i].push(y * tw + x);
    }
  return out;
}
/** Which shooting boxes hold a cap right now. */
function boxesFull(small: Float32Array, empty: Float32Array, cells: number[][]): boolean[] {
  return cells.map((cs) => cs.filter((c) => Math.abs(small[c] - empty[c]) > BOX_CELL).length >= BOX_MIN);
}

export function CameraLive({ crews, initialCrewId }: Readonly<{ crews: { id: string; name: string }[]; initialCrewId?: string }>) {
  const { t } = useT();
  const C = t.cam;
  const L = t.camLive;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<Photo | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [fix, setFixState] = useState<ZoneFix>(() => (typeof window === "undefined" ? {} : loadFix()));
  const [zonesOpen, setZonesOpen] = useState(false);
  const [status, setStatus] = useState<Status>("waiting");
  const [throws, setThrows] = useState<Throw[]>([]);
  const [ask, setAsk] = useState<{ n: number; left: number } | null>(null);
  const [fixing, setFixing] = useState<number | null>(null);
  const [crewId, setCrewId] = useState(initialCrewId ?? crews[0]?.id ?? "");
  // Keep top-down pictures of the mat for training (asked at the start).
  const [share, setShare] = useState(true);
  const shareRef = useRef(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const session = useRef<string | null>(null);
  const [loggerName, setLoggerName] = useState<string | null>(null);
  const [game, setGame] = useState<CameraGame | null>(null);
  const gameRef = useRef<CameraGame | null>(null);
  // When each line of the game was first seen here (for the log's order).
  const seenRef = useRef<Record<string, number>>({});
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<CamEvent[]>([]);
  const evNo = useRef(0);
  /** Add a line to the log (skipped when it repeats the last line). */
  const note = useCallback((text: string, tone?: CamEvent["tone"]) => {
    setEvents((es) => (es[0]?.text === text ? es : [{ key: `c${++evNo.current}`, t: Date.now(), text, tone }, ...es].slice(0, MAX_EVENTS)));
  }, []);
  // Snapshot version on the server, and the last "new snapshot" request seen.
  const snapVersion = useRef(0);
  const handledRequest = useRef(0);
  const phaseRef = useRef<Phase>("start");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Live state the camera loop reads without re-rendering.
  const live = useRef({
    corners: [] as Pt[],
    empty: null as Float32Array | null,
    still: null as Float32Array | null,
    prevTiny: null as Float32Array | null,
    base: null as Float32Array | null,
    // Linked to a mat logger: only judge while armed; armVersion bump = rebase.
    gated: false,
    armed: false,
    armVersion: 0,
    rebase: false,
    // A new round started: wait until the mat is clear before judging throws.
    clearing: false,
    clearLeft: -1,
    lastArmed: null as boolean | null,
    fix: {} as ZoneFix,
    // Shooting boxes: cells per box, the empty mat in cells, which hold a cap
    // (steady readings), and the box a cap just left (a throw started).
    boxCells: null as number[][] | null,
    emptyTiny: null as Float32Array | null,
    boxes: null as boolean[] | null,
    boxRun: [0, 0, 0, 0],
    left: null as { i: number; t: number } | null,
    calm: 0,
    busy: false,
    n: 0,
  });

  // Zone nudges are shared with the crew: version of the last one seen here.
  const fixVersion = useRef(0);
  const fixPush = useRef<number | null>(null);
  function pushFix(f: ZoneFix) {
    if (!session.current) return;
    const sid = session.current;
    if (fixPush.current) window.clearTimeout(fixPush.current);
    fixPush.current = window.setTimeout(() => {
      setCameraZoneFixAction(sid, f)
        .then((v) => (fixVersion.current = Math.max(fixVersion.current, v)))
        .catch(() => {});
    }, 400);
  }
  /** `push`: changed on this phone (share it); false: it came from another phone. */
  function setFix(f: ZoneFix, push = true) {
    setFixState(f);
    live.current.fix = f;
    live.current.boxCells = null;
    try {
      localStorage.setItem(FIX_KEY, JSON.stringify(f));
    } catch {
      /* private mode */
    }
    if (push) pushFix(f);
  }
  useEffect(() => {
    live.current.fix = fix;
    // only on mount: later changes go through setFix
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (session.current) endCameraSessionAction(session.current).catch(() => {});
    session.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  // Keep the screen on while watching.
  useEffect(() => {
    if (phase === "start" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [phase]);

  function grab(): Frame | null {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const k = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * k);
    const h = Math.round(v.videoHeight * k);
    // One canvas, reused: iOS limits the memory of all canvases together.
    canvas.current ??= document.createElement("canvas");
    const c = canvas.current;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return { w, h, data: ctx.getImageData(0, 0, w, h).data };
  }

  async function start() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setPhase("calibrate");
    } catch {
      setError(L.noCamera);
      return;
    }
    if (crewId) {
      try {
        shareRef.current = share;
        const id = await startCameraSessionAction(crewId, share);
        session.current = id;
        setSessionId(id);
        // Share the nudges this phone already has, so other phones start from them.
        if (Object.keys(live.current.fix).length) pushFix(live.current.fix);
      } catch {
        setError(L.shareError);
      }
    }
    // Give the camera a moment to settle its exposure, then snap the empty mat.
    window.setTimeout(() => void freeze(), 1500);
  }

  async function freeze() {
    const f = grab();
    if (!f) return;
    const c = canvas.current!;
    const url = await new Promise<string>((res) => c.toBlob((b) => res(b ? URL.createObjectURL(b) : c.toDataURL("image/jpeg")), "image/jpeg", 0.85));
    const frame = { ...f, data: new Uint8ClampedArray(f.data) };
    const guess = findField(frame) ?? defaultCorners(frame);
    setSnap({ url, frame });
    setCorners(guess);
    snapRef.current = frame;
    setPhase("calibrate");
    // Share it, so the corners can be set from another phone or a laptop.
    if (session.current) {
      const image = c.toDataURL("image/jpeg", 0.8);
      setCameraSnapshotAction(session.current, { image, w: frame.w, h: frame.h, corners: guess })
        .then((v) => (snapVersion.current = v))
        .catch(() => {});
    }
  }
  const snapRef = useRef<Frame | null>(null);

  /** Start watching with these corners on the current snapshot. */
  function watch(c: Pt[]) {
    const frame = snapRef.current;
    if (!frame) return;
    const empty = warp(frame, c);
    if (session.current && shareRef.current) {
      const full = warpedToJpeg(warpFull(frame, c), FULL_W, FULL_H, 0.85);
      if (full) setCameraEmptyAction(session.current, full).catch(() => {});
    }
    Object.assign(live.current, {
      corners: c, empty, still: empty, prevTiny: null, base: null, calm: 0, busy: false, clearing: false, clearLeft: -1,
      emptyTiny: tiny(empty), boxCells: null, boxes: null, boxRun: [0, 0, 0, 0], left: null,
    });
    note(L.evStart, "good");
    setCorners(c);
    setAsk(null);
    setFixing(null);
    setPhase("live");
  }

  function go() {
    watch(corners);
    if (session.current && snapVersion.current) setCameraCornersAction(session.current, snapVersion.current, corners).catch(() => {});
  }

  // The camera loop.
  useEffect(() => {
    if (phase !== "live") return;
    const id = window.setInterval(() => {
      const S = live.current;
      if (S.busy || !S.empty) return;
      const f = grab();
      if (!f) return;
      const small = tiny(warp(f, S.corners, true));
      const prev = S.prevTiny;
      S.prevTiny = small;
      if (S.gated && !S.armed) {
        // No throw expected (round over, mat being cleared): ignore it all.
        if (S.lastArmed !== false) note(L.evPaused, "muted");
        S.lastArmed = false;
        setStatus("paused");
        return;
      }
      if (S.gated && S.lastArmed !== true) {
        S.lastArmed = true;
        const g = gameRef.current;
        const who = g?.st.thrower ? g.names[g.st.thrower] : null;
        note(who ? format(L.evArmedName, { name: who }) : L.evArmed);
      }
      const idle = () => setStatus(S.clearing ? "clearing" : "waiting");
      S.boxCells ??= boxCells(S.fix);
      if (!S.base || S.rebase) {
        S.base = small;
        S.boxes = S.emptyTiny ? boxesFull(small, S.emptyTiny, S.boxCells) : null;
        S.boxRun = [0, 0, 0, 0];
        S.left = null;
        if (S.rebase) {
          // New round: start from the mat as it is now, but only once it's clear.
          S.still = warp(f, S.corners);
          const left = detect(S.empty, S.empty, S.still).present.length;
          S.clearing = left > 0;
          S.clearLeft = left;
          note(left > 0 ? format(L.evClearing, { n: left }) : L.evNewRound, left > 0 ? "warn" : "good");
        }
        S.rebase = false;
        idle();
        return;
      }
      if (prev && changed(small, prev, MOTION_CELL) >= MIN_CELLS) {
        S.calm = 0;
        setStatus("moving");
        return;
      }
      // Still: did a cap leave a shooting box? (the thrower's, when the game says who)
      if (S.emptyTiny && S.boxes) {
        const now = boxesFull(small, S.emptyTiny, S.boxCells);
        const g = gameRef.current;
        const corner = g?.st.thrower ? g.st.corner[g.st.thrower] : undefined;
        const mine = corner ? BOX_OF_CORNER[corner] : null;
        now.forEach((full, i) => {
          if (full === S.boxes![i]) return void (S.boxRun[i] = 0);
          if (++S.boxRun[i] < BOX_STEADY) return;
          S.boxRun[i] = 0;
          S.boxes![i] = full;
          if (!full && !S.clearing && (mine === null || mine === i)) {
            S.left = { i, t: Date.now() };
            note(format(L.evBoxLeft, { box: boxName(i) }));
          }
        });
      }
      const diff = changed(small, S.base, CHANGE_CELL);
      if (diff < MIN_CELLS) {
        // Still, and nothing on the mat changed (a hand passed by)…
        S.calm = 0;
        if (S.left && Date.now() - S.left.t > MISS_MS && !S.clearing) {
          // …but a cap left its box a while ago and landed nowhere: a miss.
          S.left = null;
          S.busy = true;
          window.setTimeout(() => {
            try {
              post(f, warp(f, S.corners), [], []);
              note(format(L.evMiss, { n: S.n }), "warn");
            } finally {
              S.busy = false;
              idle();
            }
          }, 30);
          return;
        }
        idle();
        return;
      }
      if (diff > LIGHT_SHARE * CELLS) {
        S.base = small;
        S.calm = 0;
        note(L.evLight, "muted");
        return;
      }
      if (++S.calm < SETTLE) return;
      // Still, and the mat changed: judge the throw.
      S.base = small;
      S.calm = 0;
      S.busy = true;
      setStatus("looking");
      window.setTimeout(() => {
        try {
          // The phone may have shifted a hair: re-fit on the empty mat.
          S.corners = align(f, S.corners, S.empty!);
          const cur = warp(f, S.corners);
          const r = detect(S.empty!, S.still!, cur);
          if (r.occluded) {
            // A hand or arm resting on the mat: judge again once it's gone.
            note(L.evHand, "muted");
            return;
          }
          S.still = cur;
          if (S.clearing) {
            // Caps being taken off for the new round: never a throw.
            if (!r.present.length) {
              S.clearing = false;
              note(L.evCleared, "good");
            } else if (r.present.length !== S.clearLeft) note(format(L.evClearing, { n: r.present.length }), "warn");
            S.clearLeft = r.present.length;
            return;
          }
          if (!r.landed.length && !r.present.length && r.gone.length >= 2) {
            // Several caps gone and the mat is empty again: it was cleared.
            note(L.evCleared, "good");
            return;
          }
          S.left = null;
          // Back onto the real print with the per-zone nudges.
          const spots = r.landed.map((b) => unfix({ x: b.x, y: b.y }, S.fix));
          const gone = r.gone.map((b) => unfix({ x: b.x, y: b.y }, S.fix));
          const n = post(f, cur, spots, gone);
          note(
            spots.length
              ? format(L.evThrow, { n, where: spotsLabel(spots, C, L), gone: gone.length })
              : gone.length
                ? format(L.evThrowGone, { n, gone: gone.length })
                : format(L.evThrowNone, { n }),
          );
        } finally {
          S.busy = false;
          idle();
        }
      }, 30);
    }, TICK);
    /** Post a judged throw (empty = a miss); returns its number. */
    function post(f: Frame, cur: Float32Array, spots: Spot[], gone: Spot[]): number {
      const S = live.current;
      const n = ++S.n;
      const img = warpedToJpeg(cur, WW, WH);
      const full = shareRef.current && session.current ? warpedToJpeg(warpFull(f, S.corners), FULL_W, FULL_H, 0.85) : null;
      setThrows((ts) => [{ n, spots, gone, corrected: false, img }, ...ts]);
      setAsk({ n, left: CONFIRM_S });
      if (session.current) addCameraThrowAction(session.current, { n, spots, gone, image: img, full, detector: DETECTOR }).catch(() => {});
      return n;
    }
    return () => window.clearInterval(id);
    // note/format only read the dictionaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Countdown on the question; at zero it counts as right.
  useEffect(() => {
    if (!ask || fixing !== null) return;
    const id = window.setTimeout(() => setAsk((a) => (!a || a.n !== ask.n ? a : a.left <= 1 ? null : { ...a, left: a.left - 1 })), 1000);
    return () => window.clearTimeout(id);
  }, [ask, fixing]);

  /** ✓ on the question: the throw is right, and reviewed. */
  function confirm(n: number) {
    setThrows((ts) => ts.map((th) => (th.n === n ? { ...th, checked: true } : th)));
    setAsk(null);
    if (session.current) checkCameraThrowAction(session.current, n).catch(() => {});
  }

  function correct(n: number, spots: Spot[]) {
    setThrows((ts) => ts.map((th) => (th.n === n ? { ...th, spots, corrected: true } : th)));
    setFixing(null);
    setAsk(null);
    if (session.current) correctCameraThrowByNAction(session.current, n, spots).catch(() => {});
  }

  // Sync with the crew: corners set on another phone or laptop, requests
  // for a new snapshot, and corrections; the poll is also the heartbeat.
  useEffect(() => {
    if (!sessionId) return;
    const id = window.setInterval(() => {
      getCameraStateAction(sessionId)
        .then((st) => {
          // Zone nudges set on another phone or laptop.
          if (st.zoneFix && st.zoneFix.version > fixVersion.current) {
            fixVersion.current = st.zoneFix.version;
            setFix(st.zoneFix.fix, false);
            note(L.evZonesRemote);
          }
          if (st.snapRequest > handledRequest.current) {
            handledRequest.current = st.snapRequest;
            void freeze();
            return;
          }
          if (phaseRef.current === "calibrate" && st.phase === "watching" && st.corners && st.snap?.version === snapVersion.current) {
            watch(st.corners);
            return;
          }
          const S = live.current;
          S.gated = st.logger !== null;
          S.armed = st.armed;
          if (st.armVersion > S.armVersion) {
            S.armVersion = st.armVersion;
            S.rebase = true;
          }
          setLoggerName(st.logger?.name ?? null);
          const g = st.logger ? asCameraGame(st.game) : null;
          gameRef.current = g;
          setGame(g);
          if (g && stampEvents(g, seenRef.current)) setSeenAt({ ...seenRef.current });
          const remote = new Map(st.throws.filter((th) => th.corrected).map((th) => [th.n, th.spots]));
          const ok = new Set(st.throws.filter((th) => th.checked).map((th) => th.n));
          if (!remote.size && !ok.size) return;
          setThrows((ts) =>
            ts.map((th) =>
              remote.has(th.n) && !th.corrected ? { ...th, spots: remote.get(th.n) ?? [], corrected: true } : ok.has(th.n) && !th.checked ? { ...th, checked: true } : th,
            ),
          );
          setAsk((a) => (a && (remote.has(a.n) || ok.has(a.n)) ? null : a));
        })
        .catch(() => {});
    }, SYNC);
    return () => window.clearInterval(id);
    // freeze/watch only touch refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const spotText = (sp: Spot[]) => spotsLabel(sp, C, L);
  /** Who throws from each shooting box (A1, B2…), from the linked game. */
  const boxLabels = boxLabelsOf(game);
  /** "box A1" in the log, or the corner number without a game. */
  function boxName(i: number) {
    return gameRef.current ? (gameRef.current.st.order.find((s) => gameRef.current?.st.corner[s] && BOX_OF_CORNER[gameRef.current.st.corner[s]!] === i)?.toUpperCase() ?? String(i + 1)) : String(i + 1);
  }
  const G = useGameText(game);
  /** What became of a camera throw: the logger's view when linked, else what the camera found. */
  function throwText(th: Throw): string {
    if (game) {
      const idx = game.links[String(th.n)];
      const rec = idx !== undefined ? game.st.throws[idx] : undefined;
      if (rec) {
        const mine = rec.moves.find((m) => m.isThrownCap);
        const knocked = rec.moves.filter((m) => !m.isThrownCap).length;
        const base = `${G.name(rec.slot)}: ${G.spot(rec.firstSpot ?? "none", rec.missed ? null : (mine?.to.countsFor ?? null))}`;
        return knocked ? `${base} · ${format(L.thrKnocked, { n: knocked })}` : base;
      }
      if (game.pending?.n === th.n) {
        const who = game.st.thrower ? G.name(game.st.thrower) : "?";
        return game.pending.touched ? format(L.thrFixing, { name: who }) : !game.pending.found ? format(L.thrNoneLogger, { name: who }) : format(L.thrPending, { name: who, s: game.pending.left });
      }
      if (th.n <= game.seen) return L.thrUnused;
    }
    if (th.spots.length) return spotText(th.spots);
    return th.gone.length ? format(L.thrGoneOnly, { n: th.gone.length }) : L.thrNone;
  }


  const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-gold";
  const primary = "h-14 rounded-[16px] bg-amber text-ink font-heading font-extrabold text-lg tracking-[0.06em] disabled:opacity-40";
  const secondary = "h-12 rounded-[14px] bg-surface-deep border border-line-strong text-cream font-heading font-extrabold text-base tracking-[0.06em]";
  const asked = ask ? throws.find((th) => th.n === ask.n) : undefined;
  const fixingThrow = fixing !== null ? throws.find((th) => th.n === fixing) : undefined;

  return (
    <div className="min-h-screen bg-surface w-full max-w-xl mx-auto flex flex-col gap-4 px-5 pt-4.5 pb-10">
      <header className="flex items-center gap-3 h-11">
        <Link href="/camera" aria-label={t.common.back} className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 flex flex-col">
          <span className="font-heading font-bold text-[12px] tracking-[0.14em] text-muted">{C.kicker}</span>
          <h1 className="font-display font-extrabold text-[28px] leading-none uppercase">{L.title}</h1>
        </span>
        {phase === "live" && (
          <button type="button" onClick={() => void freeze()} className="font-heading font-bold text-[13px] tracking-[0.08em] text-gold py-2">
            {L.recalibrate}
          </button>
        )}
      </header>

      {error && (
        <p role="alert" className="font-body text-sm font-semibold text-red-pale">
          {error}
        </p>
      )}

      {/* The video stays mounted in every phase so the stream keeps running. */}
      <div className={cn("relative rounded-[16px] overflow-hidden bg-black", phase === "start" && "hidden", phase === "calibrate" && snap && "hidden")}>
        <video ref={video} playsInline muted autoPlay className="w-full h-auto block" />
        {phase === "live" && snap && corners.length === 4 && (
          // The calibration over the live picture, with who throws from which box.
          <svg viewBox={`0 0 ${snap.frame.w} ${snap.frame.h}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <Overlay corners={corners} w={snap.frame.w} fix={fix} boxLabels={boxLabels} />
          </svg>
        )}
        {phase === "live" && (
          <span
            role="status"
            className={cn(
              "absolute top-2.5 left-2.5 px-3 py-1.5 rounded-pill font-heading font-bold text-xs tracking-[0.08em]",
              status === "moving" ? "bg-amber text-ink" : status === "looking" ? "bg-cream text-ink" : status === "clearing" ? "bg-red text-cream" : "bg-black/60 text-cream",
            )}
          >
            {status === "moving" ? L.moving : status === "looking" ? L.looking : status === "paused" ? L.paused : status === "clearing" ? L.clearing : L.waiting}
          </span>
        )}
      </div>

      {phase === "start" && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{L.startKicker}</span>
          <ul className="flex flex-col gap-2 font-body text-[15px] leading-normal text-soft list-disc pl-5">
            <li>{L.tip1}</li>
            <li>{L.tip2}</li>
            <li>{L.tip3}</li>
          </ul>
          {crews.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={kicker}>{L.shareWith}</span>
              <div className="flex flex-wrap gap-1.5">
                {crews.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={crewId === c.id}
                    onClick={() => setCrewId(c.id)}
                    className={cn("h-10 px-4 rounded-pill font-heading font-bold text-sm", crewId === c.id ? "bg-amber text-ink" : "bg-surface-deep border border-line text-soft")}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="font-body text-[13px] text-muted">{L.shareSub}</p>
              <label className="flex items-start gap-3 p-3 rounded-[14px] bg-surface-deep border border-line cursor-pointer">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-1 w-5 h-5 accent-[var(--color-amber)]" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-heading font-bold text-sm">{L.trainTitle}</span>
                  <span className="font-body text-[13px] text-muted">{L.trainSub}</span>
                </span>
              </label>
            </div>
          )}
          <button type="button" onClick={start} className={primary}>
            {L.start}
          </button>
          <Link href="/camera" className="self-center font-heading font-bold text-[13px] tracking-[0.08em] text-muted py-2">
            {L.photoMode}
          </Link>
        </section>
      )}

      {phase === "calibrate" && !snap && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{L.calKicker}</span>
          <p className="font-body text-[15px] leading-normal text-soft">{L.calSub}</p>
          <button type="button" onClick={() => void freeze()} className={primary}>
            {L.freeze}
          </button>
        </section>
      )}

      {phase === "calibrate" && snap && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{C.step2}</span>
          <p className="font-body text-[15px] leading-normal text-soft">{C.step2Auto}</p>
          {sessionId && <p className="font-body text-[13px] leading-normal text-gold">{L.remoteCal}</p>}
          <CornerEditor photo={snap} corners={corners} onChange={setCorners} labels={C} fix={fix} />
          <button type="button" aria-expanded={zonesOpen} onClick={() => setZonesOpen((o) => !o)} className="flex items-center gap-2 text-left py-1">
            <span className={kicker}>{L.zonesTitle}</span>
            {Object.keys(fix).length > 0 && <span className="font-body text-xs text-mint">{format(L.zonesCount, { n: Object.keys(fix).length })}</span>}
            <span className={cn("ml-auto text-muted transition-transform", zonesOpen && "rotate-180")}>▾</span>
          </button>
          {sessionId && <p className="font-body text-[13px] leading-normal text-gold -mt-2">{L.zonesRemoteHint}</p>}
          {zonesOpen && <ZoneEditor photo={snap} corners={corners} fix={fix} onChange={setFix} />}
          <button type="button" onClick={go} className={primary}>
            {L.go}
          </button>
          <button type="button" onClick={() => void freeze()} className={secondary}>
            {L.again}
          </button>
        </section>
      )}

      {phase === "live" && fixingThrow && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <span className={kicker}>{format(L.whereN, { n: fixingThrow.n })}</span>
          <SpotsEditor
            key={fixingThrow.n}
            src={fixingThrow.img}
            initial={fixingThrow.spots}
            gone={fixingThrow.gone}
            C={C}
            L={L}
            onSave={(sp) => correct(fixingThrow.n, sp)}
            onClose={() => setFixing(null)}
            fix={fix}
            boxLabels={boxLabels}
          />
        </section>
      )}

      {phase === "live" && !fixingThrow && asked && (
        <section className="flex flex-col gap-3 p-4 rounded-[18px] bg-surface-deep border border-gold/50" aria-live="polite">
          <span className={kicker}>{format(L.throwN, { n: asked.n })}</span>
          <p className="font-display font-extrabold text-2xl leading-tight">{asked.spots.length ? format(asked.spots.length > 1 ? L.capsIn : L.capIn, { where: spotText(asked.spots) }) : asked.gone.length ? format(L.noCapGoneQ, { n: asked.gone.length }) : L.noCapQ}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => confirm(asked.n)} className="h-12 rounded-[14px] bg-mint text-ink font-heading font-extrabold text-base tracking-[0.06em]">
              ✓ {format(L.right, { s: ask!.left })}
            </button>
            <button type="button" onClick={() => setFixing(asked.n)} className={secondary}>
              {L.wrong}
            </button>
          </div>
        </section>
      )}

      {phase === "live" && sessionId && (
        <p className="font-body text-[13px] text-muted">
          {loggerName ? format(L.linked, { name: loggerName }) : format(L.sharing, { crew: crews.find((c) => c.id === crewId)?.name ?? "" })}
        </p>
      )}

      {phase === "live" && <CameraLog game={game} seenAt={seenAt} events={events} />}

      {phase === "live" && throws.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-2">
            <span className={kicker}>{L.history}</span>
            <span className="font-body text-xs text-muted">{format(L.todoCount, { n: throws.filter((th) => !th.corrected && !th.checked).length })}</span>
          </span>
          {throws.map((th) => (
            <button
              key={th.n}
              type="button"
              onClick={() => setFixing(th.n)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-surface-deep border border-line text-left"
            >
              <span className="font-heading font-extrabold text-sm text-gold w-14">{format(C.throwShort, { n: th.n })}</span>
              <span className="flex-1 min-w-0 truncate font-body text-sm">{throwText(th)}</span>
              <ReviewBadge corrected={th.corrected} checked={th.checked === true} L={L} />
            </button>
          ))}
        </section>
      )}

      {phase === "live" && snap && <MiniOverlay photo={snap} corners={corners} fix={fix} boxLabels={boxLabels} label={L.calibration} />}
    </div>
  );
}

/** Small reminder of the calibration (zones over the empty-mat frame). */
function MiniOverlay({ photo, corners, fix, boxLabels, label }: Readonly<{ photo: Photo; corners: Pt[]; fix: ZoneFix; boxLabels: (string | null)[]; label: string }>) {
  if (!corners.length) return null;
  return (
    <details className="font-body text-xs text-muted">
      <summary className="cursor-pointer">{label}</summary>
      <div className="relative mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" className="w-full h-auto rounded-[12px]" />
        <svg viewBox={`0 0 ${photo.frame.w} ${photo.frame.h}`} className="absolute inset-0 w-full h-full" aria-hidden="true">
          <Overlay corners={corners} w={photo.frame.w} fix={fix} boxLabels={boxLabels} />
        </svg>
      </div>
    </details>
  );
}
