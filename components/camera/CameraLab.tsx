/**
 * CameraLab
 *
 * Beta test of shot tracking with the camera, one step per screen:
 *  1. photo of the empty mat;
 *  2. check the corners: the app's guess (or a default) as four handles to
 *     drag, with the zones drawn over the photo so you see if it fits;
 *  3. photo after a throw → review it on the photo itself (caps that landed,
 *     caps that got shot away) → keep it or take it again.
 * Photos stay on the phone unless downloaded.
 *
 * Data: all on-device (lib/camera.ts); photos via the phone's camera app.
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IGNORE, MAT_H, MAT_W, REAL_MAMAS, REAL_ZONES, WH, WW, align, detect, findField, spotAt, toPhoto, warp, type Blob, type Detection, type Frame, type Pt } from "@/lib/camera";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format, type Dictionary } from "@/lib/i18n";

const MAX_SIDE = 1600;

type Photo = { url: string; frame: Frame };
type Kept = { url: string; warped: Float32Array; corners: Pt[]; result: Detection };
type Phase = "empty" | "corners" | "throw" | "review";

/** Loads a picked photo into pixels (downscaled), keeping its orientation. */
async function load(file: File): Promise<Photo> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const url = await new Promise<string>((res) => canvas.toBlob((b) => res(b ? URL.createObjectURL(b) : canvas.toDataURL("image/jpeg")), "image/jpeg", 0.9));
  return { url, frame: { w: canvas.width, h: canvas.height, data: img.data } };
}

/** A starting guess when the mat isn't found: an inset rectangle. */
function defaultCorners(f: Frame): Pt[] {
  const landscape = f.w >= f.h;
  const [mx, my] = landscape ? [0.12, 0.3] : [0.3, 0.12];
  const tl = { x: f.w * mx, y: f.h * my };
  const tr = { x: f.w * (1 - mx), y: f.h * my };
  const br = { x: f.w * (1 - mx), y: f.h * (1 - my) };
  const bl = { x: f.w * mx, y: f.h * (1 - my) };
  // Mat order: left end top, right end top, right end bottom, left end bottom.
  return landscape ? [tl, tr, br, bl] : [tr, br, bl, tl];
}

export function CameraLab() {
  const { t } = useT();
  const C = t.cam;
  const file = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("empty");
  const [busy, setBusy] = useState(false);
  const [empty, setEmpty] = useState<Photo | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [auto, setAuto] = useState(false);
  const [emptyWarp, setEmptyWarp] = useState<Float32Array | null>(null);
  const [kept, setKept] = useState<Kept[]>([]);
  const [pending, setPending] = useState<(Kept & { photo: Photo }) | null>(null);
  const [minDiff, setMinDiff] = useState(45);
  const [showTop, setShowTop] = useState(false);

  const prevWarp = () => kept.at(-1)?.warped ?? emptyWarp!;

  async function onPhoto(f: File) {
    setBusy(true);
    try {
      const photo = await load(f);
      if (phase === "empty" || phase === "corners") {
        const found = findField(photo.frame);
        setEmpty(photo);
        setCorners(found ?? defaultCorners(photo.frame));
        setAuto(Boolean(found));
        setPhase("corners");
        return;
      }
      if (!empty || !emptyWarp) return;
      const prev = prevWarp();
      const prevCorners = kept.at(-1)?.corners ?? corners;
      const guess = findField(photo.frame) ?? prevCorners.map((p) => ({ x: (p.x / empty.frame.w) * photo.frame.w, y: (p.y / empty.frame.h) * photo.frame.h }));
      const c = align(photo.frame, guess, prev);
      const warped = warp(photo.frame, c);
      setPending({ url: photo.url, photo, warped, corners: c, result: detect(emptyWarp, prev, warped, minDiff) });
      setPhase("review");
    } finally {
      setBusy(false);
    }
  }

  function confirmCorners() {
    if (!empty) return;
    setEmptyWarp(warp(empty.frame, corners));
    setKept([]);
    setPhase("throw");
  }

  function keep() {
    if (!pending) return;
    setKept((k) => [...k, { url: pending.url, warped: pending.warped, corners: pending.corners, result: pending.result }]);
    setPending(null);
    setPhase("throw");
  }

  function retake() {
    setPending(null);
    setPhase("throw");
  }

  function sensitivity(v: number) {
    setMinDiff(v);
    if (pending && emptyWarp) setPending({ ...pending, result: detect(emptyWarp, prevWarp(), pending.warped, v) });
  }

  function restart() {
    setEmpty(null);
    setCorners([]);
    setEmptyWarp(null);
    setKept([]);
    setPending(null);
    setPhase("empty");
  }

  const spotLabel = (b: Blob) => {
    const s = spotAt(b);
    if (s.v === "mama") return format(C.mama, { side: s.id === "ML" ? C.left : C.right });
    if (s.v !== null) return format(C.zone, { id: s.id, v: s.v });
    return s.id === "off" ? C.off : C.none;
  };

  const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-gold";
  const primary = "h-14 rounded-[16px] bg-amber text-ink font-heading font-extrabold text-lg tracking-[0.06em] disabled:opacity-40";
  const secondary = "h-12 rounded-[14px] bg-surface-deep border border-line-strong text-cream font-heading font-extrabold text-base tracking-[0.06em]";
  const pick = () => file.current?.click();
  const stepNo = phase === "empty" ? 1 : phase === "corners" ? 2 : 3;

  return (
    <div className="min-h-screen bg-surface w-full max-w-xl mx-auto flex flex-col gap-4 px-5 pt-4.5 pb-10">
      <header className="flex items-center gap-3 h-11">
        <Link href="/settings/beta/camera" aria-label={t.common.back} className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 flex flex-col">
          <span className="font-heading font-bold text-[12px] tracking-[0.14em] text-muted">{C.kicker}</span>
          <h1 className="font-display font-extrabold text-[28px] leading-none uppercase">{C.title}</h1>
        </span>
        {phase !== "empty" && (
          <button type="button" onClick={restart} className="font-heading font-bold text-[13px] tracking-[0.08em] text-gold py-2">
            {C.restart}
          </button>
        )}
      </header>

      <ol className="grid grid-cols-3 gap-1.5" aria-label={C.title}>
        {[C.s1, C.s2, C.s3].map((label, i) => (
          <li key={label} className={cn("h-1.5 rounded-[3px]", i + 1 <= stepNo ? "bg-gold" : "bg-chip")} aria-current={i + 1 === stepNo ? "step" : undefined}>
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPhoto(f);
          e.target.value = "";
        }}
      />

      {phase === "empty" && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{C.step1}</span>
          <p className="font-body text-[15px] leading-normal text-soft">{C.step1Sub}</p>
          <button type="button" disabled={busy} onClick={pick} className={primary}>
            {busy ? C.working : C.takePhoto}
          </button>
        </section>
      )}

      {phase === "corners" && empty && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{C.step2}</span>
          <p className="font-body text-[15px] leading-normal text-soft">{auto ? C.step2Auto : C.step2Manual}</p>
          <CornerEditor photo={empty} corners={corners} onChange={setCorners} labels={C} />
          <button type="button" onClick={confirmCorners} className={primary}>
            {C.cornersOk}
          </button>
          <button type="button" disabled={busy} onClick={pick} className={secondary}>
            {C.newEmpty}
          </button>
        </section>
      )}

      {phase === "throw" && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{format(C.throwN, { n: kept.length + 1 })}</span>
          <p className="font-body text-[15px] leading-normal text-soft">{C.step3Sub}</p>
          <button type="button" disabled={busy} onClick={pick} className={primary}>
            {busy ? C.working : format(C.throwPhoto, { n: kept.length + 1 })}
          </button>
          {kept.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {[...kept].reverse().map((k, i) => (
                <div key={k.url} className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-surface-deep border border-line">
                  <span className="font-heading font-extrabold text-sm text-gold w-14">{format(C.throwShort, { n: kept.length - i })}</span>
                  <span className="flex-1 min-w-0 truncate font-body text-sm">
                    {k.result.landed.length ? k.result.landed.map(spotLabel).join(", ") : C.nothingShort}
                  </span>
                  <a href={k.url} download={`shussapp-mat-${kept.length - i}.jpg`} aria-label={C.download} className="font-heading font-bold text-xs text-muted">
                    ↓
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {phase === "review" && pending && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{format(C.throwN, { n: kept.length + 1 })}</span>
          <PhotoWithFinds photo={pending.photo} corners={pending.corners} result={pending.result} />
          {pending.result.occluded && <p className="font-body text-sm font-semibold text-red-pale">{C.occluded}</p>}
          <ul className="flex flex-col gap-1 font-body text-[15px]">
            {pending.result.landed.map((b, i) => (
              <li key={`l${i}`} className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-pill bg-gold" aria-hidden="true" />
                {format(C.landed, { spot: spotLabel(b) })}
              </li>
            ))}
            {pending.result.gone.map((b, i) => (
              <li key={`g${i}`} className="flex items-center gap-2 text-red-pale">
                <span className="w-3.5 h-3.5 rounded-pill border-2 border-dashed border-red-pale" aria-hidden="true" />
                {format(C.gone, { spot: spotLabel(b) })}
              </li>
            ))}
            {!pending.result.occluded && pending.result.landed.length === 0 && pending.result.gone.length === 0 && <li className="text-muted">{C.nothing}</li>}
          </ul>
          <label className="flex items-center gap-3 font-body text-sm text-soft">
            {C.sensitivity}
            <input type="range" min={10} max={90} step={5} value={100 - minDiff} onChange={(e) => sensitivity(100 - Number(e.target.value))} className="flex-1 accent-[var(--color-gold)]" />
          </label>
          <button type="button" onClick={keep} className={primary}>
            {C.keep}
          </button>
          <button type="button" onClick={retake} className={secondary}>
            {C.retake}
          </button>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setShowTop((v) => !v)} className="font-heading font-bold text-[13px] tracking-[0.08em] text-muted py-2">
              {showTop ? C.hideTop : C.showTop}
            </button>
            <a href={pending.url} download={`shussapp-mat-${kept.length + 1}.jpg`} className="font-heading font-bold text-[13px] tracking-[0.08em] text-muted py-2">
              {C.download}
            </a>
          </div>
          {showTop && <TopDown warped={pending.warped} label={C.topDown} />}
        </section>
      )}

      <p className="font-body text-xs text-muted">{C.privacy}</p>
    </div>
  );
}

/** Corner fine-tuning: pick a corner, see it magnified, nudge it with the
 * arrows (or drag it), tick it off. The zones are drawn over the photo so
 * you can see when everything lines up. */
function CornerEditor({ photo, corners, onChange, labels }: Readonly<{ photo: Photo; corners: Pt[]; onChange: (c: Pt[]) => void; labels: Dictionary["cam"] }>) {
  const svg = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState(0);
  const [drag, setDrag] = useState(false);
  const [fine, setFine] = useState(true);
  const [done, setDone] = useState<boolean[]>([false, false, false, false]);
  const { w, h } = photo.frame;
  const r = Math.max(w, h) / 40;
  const step = (Math.max(w, h) / (fine ? 600 : 120));

  const move = (dx: number, dy: number) =>
    onChange(corners.map((p, i) => (i === sel ? { x: Math.min(w, Math.max(0, p.x + dx * step)), y: Math.min(h, Math.max(0, p.y + dy * step)) } : p)));
  function at(e: ReactPointerEvent): Pt {
    const b = svg.current!.getBoundingClientRect();
    return { x: Math.min(w, Math.max(0, ((e.clientX - b.left) / b.width) * w)), y: Math.min(h, Math.max(0, ((e.clientY - b.top) / b.height) * h)) };
  }
  function tick() {
    setDone((d) => d.map((v, i) => (i === sel ? true : v)));
    setSel((i) => (i + 1) % 4);
  }

  const c = corners[sel];
  const zoom = Math.max(w, h) / 9;
  const arrow = "h-14 rounded-[14px] bg-surface-deep border border-line-strong text-cream text-2xl font-bold active:bg-surface-raised";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" className="w-full h-auto rounded-[16px]" draggable={false} />
        <svg
          ref={svg}
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerMove={(e) => drag && onChange(corners.map((p, i) => (i === sel ? at(e) : p)))}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
        >
          <Overlay corners={corners} w={w} />
          {corners.map((p, i) => (
            <g
              key={i}
              onPointerDown={(e) => {
                svg.current?.setPointerCapture(e.pointerId);
                setSel(i);
                setDrag(true);
              }}
            >
              <circle cx={p.x} cy={p.y} r={r * 1.6} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={r} fill={i === sel ? "rgba(255,182,39,0.45)" : "rgba(255,255,255,0.2)"} stroke={i === sel ? "#ffb627" : "#fff"} strokeWidth={w / 250} />
              <text x={p.x} y={p.y + r * 0.35} textAnchor="middle" fontSize={r} fontWeight={800} fill={done[i] ? "#7fe0a8" : "#111"}>
                {done[i] ? "✓" : i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
        <svg viewBox={`${c.x - zoom / 2} ${c.y - zoom / 2} ${zoom} ${zoom}`} className="w-full aspect-square rounded-[14px] border border-line-strong bg-black" aria-label={format(labels.cornerN, { n: sel + 1 })}>
          <image href={photo.url} x={0} y={0} width={w} height={h} />
          <Overlay corners={corners} w={zoom * 2} />
          <line x1={c.x - zoom} x2={c.x + zoom} y1={c.y} y2={c.y} stroke="#ffb627" strokeWidth={zoom / 150} />
          <line x1={c.x} x2={c.x} y1={c.y - zoom} y2={c.y + zoom} stroke="#ffb627" strokeWidth={zoom / 150} />
        </svg>
        <div className="grid grid-cols-3 gap-1.5 w-44">
          <span />
          <button type="button" onClick={() => move(0, -1)} aria-label={labels.up} className={arrow}>↑</button>
          <span />
          <button type="button" onClick={() => move(-1, 0)} aria-label={labels.left2} className={arrow}>←</button>
          <button type="button" onClick={tick} aria-label={labels.cornerDone} className="h-14 rounded-[14px] bg-mint text-ink text-2xl font-bold">✓</button>
          <button type="button" onClick={() => move(1, 0)} aria-label={labels.right2} className={arrow}>→</button>
          <span />
          <button type="button" onClick={() => move(0, 1)} aria-label={labels.down} className={arrow}>↓</button>
          <button type="button" onClick={() => setFine((f) => !f)} aria-pressed={!fine} className="h-14 rounded-[14px] border border-line-strong text-[11px] font-heading font-bold tracking-[0.08em] text-muted">
            {fine ? labels.fine : labels.coarse}
          </button>
        </div>
      </div>

      <div role="group" aria-label={labels.step2} className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={sel === i}
            onClick={() => setSel(i)}
            className={cn("h-11 rounded-[12px] font-heading font-extrabold text-base", sel === i ? "bg-amber text-ink" : done[i] ? "bg-mint/15 text-mint border border-mint/40" : "bg-surface-deep border border-line text-muted")}
          >
            {done[i] ? `✓ ${i + 1}` : format(labels.cornerShort, { n: i + 1 })}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The mat's zones, mamas and outline projected onto the photo. */
function Overlay({ corners, w }: Readonly<{ corners: Pt[]; w: number }>) {
  const P = (x: number, y: number) => {
    const p = toPhoto(corners, { x, y });
    return `${p.x},${p.y}`;
  };
  const sw = w / 300;
  return (
    <g pointerEvents="none">
      <polygon points={[P(0, 0), P(MAT_W, 0), P(MAT_W, MAT_H), P(0, MAT_H)].join(" ")} fill="none" stroke="#ffb627" strokeWidth={sw * 1.4} />
      {REAL_ZONES.map((z) => (
        <polygon key={z.id} points={z.pts.map(([x, y]) => P(x, y)).join(" ")} fill="rgba(79,209,255,0.12)" stroke="#4fd1ff" strokeWidth={sw} />
      ))}
      {REAL_MAMAS.map((m) => (
        <polygon key={m.id} points={[P(m.x, m.y), P(m.x + m.w, m.y), P(m.x + m.w, m.y + m.h), P(m.x, m.y + m.h)].join(" ")} fill="rgba(255,107,91,0.2)" stroke="#ff6b5b" strokeWidth={sw} />
      ))}
    </g>
  );
}

/** The throw photo with what was found: landed caps solid, gone caps dashed. */
function PhotoWithFinds({ photo, corners, result }: Readonly<{ photo: Photo; corners: Pt[]; result: Detection }>) {
  const { w, h } = photo.frame;
  const scale = Math.hypot(toPhoto(corners, { x: MAT_W, y: 0 }).x - toPhoto(corners, { x: 0, y: 0 }).x, toPhoto(corners, { x: MAT_W, y: 0 }).y - toPhoto(corners, { x: 0, y: 0 }).y) / MAT_W;
  const R = Math.max(6, 22 * scale);
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="w-full h-auto rounded-[16px]" />
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <Overlay corners={corners} w={w} />
        {result.gone.map((b, i) => {
          const p = toPhoto(corners, b);
          return <circle key={`g${i}`} cx={p.x} cy={p.y} r={R} fill="none" stroke="#ff8a7c" strokeWidth={w / 180} strokeDasharray={`${w / 90} ${w / 120}`} />;
        })}
        {result.landed.map((b, i) => {
          const p = toPhoto(corners, b);
          return <circle key={`l${i}`} cx={p.x} cy={p.y} r={R} fill="none" stroke="#ffb627" strokeWidth={w / 120} />;
        })}
      </svg>
    </div>
  );
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
      <div className="relative">
        <canvas ref={ref} width={WW} height={WH} className="w-full h-auto rounded-[12px] border border-line" aria-label={label} />
        <svg viewBox={`0 0 ${MAT_W} ${MAT_H}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          {IGNORE.map((r) => (
            <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="rgba(255,255,255,0.35)" strokeDasharray="6 5" />
          ))}
        </svg>
      </div>
      <figcaption className="font-body text-xs text-muted">{label}</figcaption>
    </figure>
  );
}
