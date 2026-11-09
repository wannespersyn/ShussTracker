/**
 * CameraLab
 *
 * Beta test of shot tracking with the camera: photo of the empty mat (the
 * app finds the mat itself; tap the corners only if it can't), then a photo
 * after every throw — handheld is fine, every photo is lined up again.
 * Shows where caps landed and which got shot away, on a drawn mat and as a
 * top-down view of what the app sees. Photos stay on the phone unless
 * downloaded.
 *
 * Data: all on-device (lib/camera.ts); live camera via getUserMedia or a
 * picked photo.
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BOTTLES, MAMAS, ZONES } from "@/lib/mat";
import { MAT_H, MAT_W, WH, WW, align, detect, findField, spotAt, warp, type Blob, type Detection, type Frame, type Pt } from "@/lib/camera";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

const MAX_SIDE = 1600;

type Shot = { url: string; warped: Float32Array; result: Detection | null };

/** Loads an image (file or camera still) into pixels, downscaled. */
async function toFrame(src: HTMLVideoElement | File): Promise<{ frame: Frame; url: string }> {
  const canvas = document.createElement("canvas");
  let w: number;
  let h: number;
  let draw: (ctx: CanvasRenderingContext2D) => void;
  if (src instanceof HTMLVideoElement) {
    w = src.videoWidth;
    h = src.videoHeight;
    draw = (ctx) => ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  } else {
    const bmp = await createImageBitmap(src);
    w = bmp.width;
    h = bmp.height;
    draw = (ctx) => ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  }
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  draw(ctx);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const url = await new Promise<string>((res) => canvas.toBlob((b) => res(b ? URL.createObjectURL(b) : canvas.toDataURL("image/jpeg")), "image/jpeg", 0.88));
  return { frame: { w: canvas.width, h: canvas.height, data: img.data }, url };
}

export function CameraLab() {
  const { t } = useT();
  const C = t.cam;
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState(false);
  const [empty, setEmpty] = useState<{ url: string; frame: Frame } | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [auto, setAuto] = useState(false);
  const [emptyWarp, setEmptyWarp] = useState<Float32Array | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [minDiff, setMinDiff] = useState(45);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const v = video.current;
    return () => {
      const stream = v?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false });
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play();
      }
      setLive(true);
    } catch {
      setCamError(true);
    }
  }

  async function capture(src: HTMLVideoElement | File) {
    setBusy(true);
    try {
      const shot = await toFrame(src);
      if (!empty) {
        setEmpty(shot);
        // Find the black playing field; fall back to tapping the corners.
        const found = findField(shot.frame);
        if (found) applyCorners(shot.frame, found, true);
        else setCorners([]);
        return;
      }
      if (!emptyWarp) return;
      const prev = shots.at(-1)?.warped ?? emptyWarp;
      // Line every photo up again: handheld photos never match exactly.
      const guess = findField(shot.frame) ?? scaleCorners(corners, empty.frame, shot.frame);
      const warped = warp(shot.frame, align(shot.frame, guess, prev));
      setShots((s) => [...s, { url: shot.url, warped, result: detect(emptyWarp, prev, warped, minDiff) }]);
    } finally {
      setBusy(false);
    }
  }

  function applyCorners(frame: Frame, c: Pt[], found: boolean) {
    setCorners(c);
    setAuto(found);
    setEmptyWarp(warp(frame, c));
    setShots([]);
  }

  function tapCorner(e: React.MouseEvent<HTMLImageElement>) {
    if (!empty || corners.length >= 4) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * empty.frame.w, y: ((e.clientY - r.top) / r.height) * empty.frame.h };
    const next = [...corners, p];
    if (next.length === 4) applyCorners(empty.frame, next, false);
    else setCorners(next);
  }

  function retap() {
    setCorners([]);
    setAuto(false);
    setEmptyWarp(null);
    setShots([]);
  }

  // Re-run detection when the sensitivity changes.
  function redetect(v: number) {
    setMinDiff(v);
    if (!emptyWarp) return;
    setShots((s) => s.map((x, i) => ({ ...x, result: detect(emptyWarp, i === 0 ? emptyWarp : s[i - 1].warped, x.warped, v) })));
  }

  function reset() {
    setEmpty(null);
    setCorners([]);
    setAuto(false);
    setEmptyWarp(null);
    setShots([]);
  }

  const spotLabel = (b: Blob) => {
    const s = spotAt(b);
    if (s.v === "mama") return format(C.mama, { side: s.id === "ML" ? C.left : C.right });
    if (s.v !== null) return format(C.zone, { id: s.id, v: s.v });
    return s.id === "off" ? C.off : C.none;
  };
  const step = !empty ? 1 : corners.length < 4 ? 2 : 3;
  const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-muted";
  const btn = "h-12 px-4 rounded-[14px] font-heading font-extrabold text-base tracking-[0.06em] disabled:opacity-40";

  const captureButtons = (
    <div className="flex flex-wrap gap-2">
      {live ? (
        <button type="button" disabled={busy} onClick={() => video.current && capture(video.current)} className={cn(btn, "flex-1 bg-amber text-ink")}>
          {step === 1 ? C.takePhoto : C.throwPhoto}
        </button>
      ) : (
        <button type="button" onClick={startCamera} className={cn(btn, "flex-1 bg-amber text-ink")}>
          {C.useCamera}
        </button>
      )}
      <button type="button" disabled={busy} onClick={() => file.current?.click()} className={cn(btn, "bg-surface-deep border border-line-strong text-cream")}>
        {C.pickPhoto}
      </button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) capture(f);
          e.target.value = "";
        }}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface w-full max-w-xl mx-auto flex flex-col gap-4.5 px-5 pt-4.5 pb-10">
      <header className="flex items-center gap-3 h-11">
        <Link href="/settings/beta/camera" aria-label={t.common.back} className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 flex flex-col">
          <span className={kicker}>{C.kicker}</span>
          <h1 className="font-display font-extrabold text-[28px] leading-none uppercase">{C.title}</h1>
        </span>
        {empty && (
          <button type="button" onClick={reset} className="font-heading font-bold text-[13px] tracking-[0.08em] text-gold py-2">
            {C.redo}
          </button>
        )}
      </header>

      <video ref={video} playsInline muted className={cn("w-full rounded-[16px] bg-black", live && step !== 2 ? "block" : "hidden")} />
      {camError && <p className="font-body text-sm text-red-pale">{C.noCamera}</p>}

      <section className="flex flex-col gap-2">
        <span className={cn(kicker, step === 1 && "text-gold")}>{C.step1}</span>
        {step === 1 && (
          <>
            <p className="font-body text-sm text-soft">{C.step1Sub}</p>
            {captureButtons}
          </>
        )}
      </section>

      {empty && (
        <section className="flex flex-col gap-2">
          <span className={cn(kicker, step === 2 && "text-gold")}>{C.step2}</span>
          {step === 2 && <p className="font-body text-sm text-soft">{C.step2Sub2} {C.step2Sub} · <strong className="text-gold">{format(C.cornerN, { n: corners.length + 1 })}</strong></p>}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={empty.url} alt={C.step1} onClick={tapCorner} className={cn("w-full rounded-[16px] select-none", step === 2 && "cursor-crosshair")} />
            <svg viewBox={`0 0 ${empty.frame.w} ${empty.frame.h}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              {corners.length > 1 && <polygon points={corners.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(255,182,39,0.12)" stroke="#ffb627" strokeWidth={empty.frame.w / 300} />}
              {corners.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={empty.frame.w / 70} fill="#ffb627" stroke="#111" strokeWidth={empty.frame.w / 400} />
                  <text x={p.x} y={p.y + empty.frame.w / 200} textAnchor="middle" fontSize={empty.frame.w / 60} fontWeight={800} fill="#111">
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          {step === 2 && corners.length > 0 && (
            <button type="button" onClick={() => setCorners((c) => c.slice(0, -1))} className="self-start font-heading font-bold text-[13px] tracking-[0.08em] text-gold py-2">
              {C.undoCorner}
            </button>
          )}
          {step === 3 && (
            <div className="flex items-center justify-between gap-3">
              <span className="font-body text-xs text-muted">{auto ? C.foundAuto : C.foundManual}</span>
              <button type="button" onClick={retap} className="shrink-0 font-heading font-bold text-[13px] tracking-[0.08em] text-gold py-2">
                {C.fixCorners}
              </button>
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <>
          <section className="flex flex-col gap-2">
            <span className={cn(kicker, "text-gold")}>{C.step3}</span>
            <p className="font-body text-sm text-soft">{C.step3Sub}</p>
            {captureButtons}
            <label className="flex items-center gap-3 font-body text-sm text-soft">
              {C.sensitivity}
              <input type="range" min={10} max={90} step={5} value={100 - minDiff} onChange={(e) => redetect(100 - Number(e.target.value))} className="flex-1 accent-[var(--color-gold)]" />
            </label>
          </section>

          {emptyWarp && <TopDown label={C.topDown} warped={shots.at(-1)?.warped ?? emptyWarp} />}

          {[...shots].reverse().map((s, k) => {
            const n = shots.length - k;
            const r = s.result;
            return (
              <article key={s.url} className="flex flex-col gap-2.5 p-3.5 rounded-[18px] bg-surface-deep border border-line">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-extrabold text-[15px] tracking-[0.14em] text-gold">{format(C.throwN, { n })}</span>
                  <a href={s.url} download={`shussapp-mat-${n}.jpg`} className="font-heading font-bold text-[12px] tracking-[0.08em] text-muted">
                    {C.download}
                  </a>
                </div>
                <MatPlot result={r} />
                {r?.occluded && <p className="font-body text-sm text-red-pale">{C.occluded}</p>}
                <ul className="flex flex-col gap-1 font-body text-sm">
                  {r?.landed.map((b, i) => (
                    <li key={`l${i}`} className="text-cream">● {format(C.landed, { spot: spotLabel(b) })}</li>
                  ))}
                  {r?.gone.map((b, i) => (
                    <li key={`g${i}`} className="text-red-pale">○ {format(C.gone, { spot: spotLabel(b) })}</li>
                  ))}
                  {r && !r.occluded && r.landed.length === 0 && r.gone.length === 0 && <li className="text-muted">{C.nothing}</li>}
                </ul>
                {r && <span className="font-body text-xs text-muted">{format(C.present, { n: r.present.length })}</span>}
              </article>
            );
          })}
        </>
      )}

      <p className="font-body text-xs text-muted">{C.privacy}</p>
    </div>
  );
}

/** Corners from one photo, scaled to another photo's size (same framing). */
function scaleCorners(c: Pt[], from: Frame, to: Frame): Pt[] {
  return c.map((p) => ({ x: (p.x / from.w) * to.w, y: (p.y / from.h) * to.h }));
}

/** The warped top-down image, so you can see what the detection works on. */
function TopDown({ warped, label }: Readonly<{ warped: Float32Array; label: string }>) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(WW, WH);
    for (let p = 0; p < WW * WH; p++) {
      img.data[p * 4] = warped[p * 3];
      img.data[p * 4 + 1] = warped[p * 3 + 1];
      img.data[p * 4 + 2] = warped[p * 3 + 2];
      img.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [warped]);
  return (
    <figure className="flex flex-col gap-1.5">
      <canvas ref={ref} width={WW} height={WH} className="w-full rounded-[12px] border border-line" aria-label={label} />
      <figcaption className="font-body text-xs text-muted">{label}</figcaption>
    </figure>
  );
}

/** The drawn mat with what this photo found: landed caps solid, gone caps dashed. */
function MatPlot({ result }: Readonly<{ result: Detection | null }>) {
  return (
    <svg viewBox={`0 0 ${MAT_W} ${MAT_H}`} className="w-full rounded-[12px] bg-[#1d2224]" aria-hidden="true">
      {ZONES.map((z) => (
        <polygon key={z.id} points={z.pts.map((p) => p.join(",")).join(" ")} fill="rgba(243,241,234,0.05)" stroke="rgba(243,241,234,0.25)" strokeWidth={2} />
      ))}
      {MAMAS.map((m) => (
        <rect key={m.id} x={m.x} y={m.y} width={m.w} height={m.h} rx={6} fill="rgba(255,107,91,0.2)" stroke="#ff6b5b" strokeWidth={2} />
      ))}
      {BOTTLES.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={19} fill="#4A2A1C" />
      ))}
      {result?.present.map((b, i) => (
        <circle key={`p${i}`} cx={b.x} cy={b.y} r={16} fill="rgba(243,241,234,0.25)" />
      ))}
      {result?.gone.map((b, i) => (
        <circle key={`g${i}`} cx={b.x} cy={b.y} r={18} fill="none" stroke="#ff8a7c" strokeWidth={4} strokeDasharray="6 5" />
      ))}
      {result?.landed.map((b, i) => (
        <circle key={`l${i}`} cx={b.x} cy={b.y} r={16} fill="#ffb627" stroke="#111" strokeWidth={3} />
      ))}
    </svg>
  );
}
