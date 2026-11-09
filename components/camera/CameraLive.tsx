/**
 * CameraLive
 *
 * Beta: live shot tracking with the phone fixed above the mat (a stand or a
 * clamp). One calibration on the empty mat, then the camera keeps watching:
 *  - every ~0.3 s a frame is warped top-down and compared with the last one;
 *    big changes = someone is throwing or leaning in ("movement");
 *  - once the picture has been still for ~1 s after movement, that still
 *    frame is compared with the empty mat and the previous still frame
 *    (lib/camera detect) → the cap that landed, if any;
 *  - the player sees "Cap in zone 2?" and does nothing when it's right; a
 *    tap on "Wrong" lets them point at the real spot on the mat (or say
 *    there was no cap). Corrections are kept with the throw, so they can
 *    later become training data.
 * Everything runs on the phone; nothing is uploaded.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { MAT_H, MAT_W, REAL_MAMAS, REAL_ZONES, WH, WW, align, detect, findField, spotAt, warp, type Frame, type Pt } from "@/lib/camera";
import { CornerEditor, Overlay, defaultCorners, type Photo } from "@/components/camera/CameraLab";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

/** Frames are grabbed at most this big (long side). */
const MAX_SIDE = 1280;
/** How often the camera is looked at (ms). */
const TICK = 300;
/** Mean change per pixel (0–255) that counts as movement / as still. */
const MOVING = 7;
const STILL = 3.5;
/** Still ticks in a row before a throw is judged (~1 s). */
const SETTLE = 3;
/** Seconds a "cap in zone X?" question stays before it counts as right. */
const CONFIRM_S = 6;

type Phase = "start" | "calibrate" | "live";
type Status = "waiting" | "moving" | "looking";
type Spot = { x: number; y: number } | null;
type Throw = { n: number; spot: Spot; corrected: boolean; warped: Float32Array };

/** Small grey copy of a warped frame for the movement check. */
function tiny(w: Float32Array): Float32Array {
  const S = 4;
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

function change(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

export function CameraLive() {
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
  const [status, setStatus] = useState<Status>("waiting");
  const [throws, setThrows] = useState<Throw[]>([]);
  const [ask, setAsk] = useState<{ n: number; left: number } | null>(null);
  const [fixing, setFixing] = useState<number | null>(null);

  // Live state the camera loop reads without re-rendering.
  const live = useRef({
    corners: [] as Pt[],
    empty: null as Float32Array | null,
    still: null as Float32Array | null,
    prevTiny: null as Float32Array | null,
    moved: false,
    calm: 0,
    busy: false,
    n: 0,
  });

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  // Keep the screen on while watching.
  useEffect(() => {
    if (phase !== "live" || !("wakeLock" in navigator)) return;
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
    }
  }

  async function freeze() {
    const f = grab();
    if (!f) return;
    const c = canvas.current!;
    const url = await new Promise<string>((res) => c.toBlob((b) => res(b ? URL.createObjectURL(b) : c.toDataURL("image/jpeg")), "image/jpeg", 0.85));
    const frame = { ...f, data: new Uint8ClampedArray(f.data) };
    setSnap({ url, frame });
    setCorners(findField(frame) ?? defaultCorners(frame));
  }

  function go() {
    if (!snap) return;
    const empty = warp(snap.frame, corners);
    Object.assign(live.current, { corners, empty, still: empty, prevTiny: null, moved: false, calm: 0, busy: false, n: 0 });
    setThrows([]);
    setAsk(null);
    setFixing(null);
    setPhase("live");
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
      const d = S.prevTiny ? change(small, S.prevTiny) : 0;
      S.prevTiny = small;
      if (d > MOVING) {
        S.moved = true;
        S.calm = 0;
        setStatus("moving");
        return;
      }
      if (d > STILL || !S.moved) return;
      if (++S.calm < SETTLE) return;
      // Still again after movement: judge the throw.
      S.moved = false;
      S.calm = 0;
      S.busy = true;
      setStatus("looking");
      window.setTimeout(() => {
        try {
          // The phone may have shifted a hair: re-fit on the empty mat.
          S.corners = align(f, S.corners, S.empty!);
          const cur = warp(f, S.corners);
          const r = detect(S.empty!, S.still!, cur);
          S.still = cur;
          const cap = r.landed[0];
          const n = ++S.n;
          setThrows((ts) => [{ n, spot: cap ? { x: cap.x, y: cap.y } : null, corrected: false, warped: cur }, ...ts]);
          setAsk({ n, left: CONFIRM_S });
        } finally {
          S.busy = false;
          setStatus("waiting");
        }
      }, 30);
    }, TICK);
    return () => window.clearInterval(id);
  }, [phase]);

  // Countdown on the question; at zero it counts as right.
  useEffect(() => {
    if (!ask || fixing !== null) return;
    const id = window.setTimeout(() => setAsk((a) => (!a || a.n !== ask.n ? a : a.left <= 1 ? null : { ...a, left: a.left - 1 })), 1000);
    return () => window.clearTimeout(id);
  }, [ask, fixing]);

  function correct(n: number, spot: Spot) {
    setThrows((ts) => ts.map((th) => (th.n === n ? { ...th, spot, corrected: true } : th)));
    setFixing(null);
    setAsk(null);
  }

  const spotText = (s: Spot) => {
    if (!s) return L.noCap;
    const z = spotAt(s);
    if (z.v === "mama") return format(C.mama, { side: z.id === "ML" ? C.left : C.right });
    if (z.v !== null) return format(C.zone, { id: z.id, v: z.v });
    return z.id === "off" ? C.off : C.none;
  };

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
          <button type="button" onClick={() => setPhase("calibrate")} className="font-heading font-bold text-[13px] tracking-[0.08em] text-gold py-2">
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
        {phase === "live" && (
          <span
            role="status"
            className={cn(
              "absolute top-2.5 left-2.5 px-3 py-1.5 rounded-pill font-heading font-bold text-xs tracking-[0.08em]",
              status === "moving" ? "bg-amber text-ink" : status === "looking" ? "bg-cream text-ink" : "bg-black/60 text-cream",
            )}
          >
            {status === "moving" ? L.moving : status === "looking" ? L.looking : L.waiting}
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
          <button type="button" onClick={freeze} className={primary}>
            {L.freeze}
          </button>
        </section>
      )}

      {phase === "calibrate" && snap && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{C.step2}</span>
          <p className="font-body text-[15px] leading-normal text-soft">{C.step2Auto}</p>
          <CornerEditor photo={snap} corners={corners} onChange={setCorners} labels={C} />
          <button type="button" onClick={go} className={primary}>
            {L.go}
          </button>
          <button type="button" onClick={() => setSnap(null)} className={secondary}>
            {L.again}
          </button>
        </section>
      )}

      {phase === "live" && fixingThrow && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <span className={kicker}>{format(L.whereN, { n: fixingThrow.n })}</span>
          <p className="font-body text-[15px] leading-normal text-soft">{L.whereSub}</p>
          <MatTap warped={fixingThrow.warped} label={L.whereSub} onTap={(p) => correct(fixingThrow.n, p)} />
          <button type="button" onClick={() => correct(fixingThrow.n, null)} className={secondary}>
            {L.noCapBtn}
          </button>
          <button type="button" onClick={() => setFixing(null)} className="font-heading font-bold text-[13px] tracking-[0.08em] text-muted py-2">
            {t.common.close}
          </button>
        </section>
      )}

      {phase === "live" && !fixingThrow && asked && (
        <section className="flex flex-col gap-3 p-4 rounded-[18px] bg-surface-deep border border-gold/50" aria-live="polite">
          <span className={kicker}>{format(L.throwN, { n: asked.n })}</span>
          <p className="font-display font-extrabold text-2xl leading-tight">{asked.spot ? format(L.capIn, { where: spotText(asked.spot) }) : L.noCapQ}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAsk(null)} className="h-12 rounded-[14px] bg-mint text-ink font-heading font-extrabold text-base tracking-[0.06em]">
              ✓ {format(L.right, { s: ask!.left })}
            </button>
            <button type="button" onClick={() => setFixing(asked.n)} className={secondary}>
              {L.wrong}
            </button>
          </div>
        </section>
      )}

      {phase === "live" && throws.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <span className={kicker}>{L.history}</span>
          {throws.map((th) => (
            <button
              key={th.n}
              type="button"
              onClick={() => setFixing(th.n)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-surface-deep border border-line text-left"
            >
              <span className="font-heading font-extrabold text-sm text-gold w-14">{format(C.throwShort, { n: th.n })}</span>
              <span className="flex-1 min-w-0 truncate font-body text-sm">{spotText(th.spot)}</span>
              {th.corrected && <span className="font-heading font-bold text-[11px] tracking-[0.08em] text-muted">{L.fixed}</span>}
            </button>
          ))}
        </section>
      )}

      {phase === "live" && snap && <MiniOverlay photo={snap} corners={corners} label={L.calibration} />}
    </div>
  );
}

/** Small reminder of the calibration (zones over the empty-mat frame). */
function MiniOverlay({ photo, corners, label }: Readonly<{ photo: Photo; corners: Pt[]; label: string }>) {
  if (!corners.length) return null;
  return (
    <details className="font-body text-xs text-muted">
      <summary className="cursor-pointer">{label}</summary>
      <div className="relative mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" className="w-full h-auto rounded-[12px]" />
        <svg viewBox={`0 0 ${photo.frame.w} ${photo.frame.h}`} className="absolute inset-0 w-full h-full" aria-hidden="true">
          <Overlay corners={corners} w={photo.frame.w} />
        </svg>
      </div>
    </details>
  );
}

/** The mat seen from above (that throw's frame) with the zones: tap where
 * the cap really lies. */
function MatTap({ warped, label, onTap }: Readonly<{ warped: Float32Array; label: string; onTap: (p: { x: number; y: number }) => void }>) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const img = ctx.createImageData(WW, WH);
    for (let p = 0; p < WW * WH; p++) {
      img.data[p * 4] = warped[p * 3];
      img.data[p * 4 + 1] = warped[p * 3 + 1];
      img.data[p * 4 + 2] = warped[p * 3 + 2];
      img.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [warped]);
  function tap(e: ReactMouseEvent<HTMLButtonElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    onTap({ x: ((e.clientX - b.left) / b.width) * MAT_W, y: ((e.clientY - b.top) / b.height) * MAT_H });
  }
  return (
    <button type="button" onClick={tap} aria-label={label} className="relative block w-full">
      <canvas ref={ref} width={WW} height={WH} className="w-full h-auto rounded-[12px] border border-line" />
      <svg viewBox={`0 0 ${MAT_W} ${MAT_H}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        {REAL_ZONES.map((z) => (
          <polygon key={z.id} points={z.pts.map(([x, y]) => `${x},${y}`).join(" ")} fill="rgba(79,209,255,0.10)" stroke="#4fd1ff" strokeWidth={1.5} />
        ))}
        {REAL_MAMAS.map((m) => (
          <rect key={m.id} x={m.x} y={m.y} width={m.w} height={m.h} fill="rgba(255,107,91,0.15)" stroke="#ff6b5b" strokeWidth={1.5} />
        ))}
      </svg>
    </button>
  );
}
