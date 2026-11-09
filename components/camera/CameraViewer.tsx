/**
 * CameraViewer
 *
 * Follow a crew member's live camera from your own phone: the newest throw
 * with its top-down picture and "Cap in zone X?", a tap on "Wrong" to point
 * at the real spot (or say there was no cap), and the list of throws (tap
 * one to fix it later). Polls the session every 2 s; pictures are fetched
 * only for the throw being looked at.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { spotAt } from "@/lib/camera";
import type { CameraState } from "@/lib/db/camera";
import { MatPick } from "@/components/camera/MatPick";
import { correctCameraThrowAction, getCameraStateAction, getCameraThrowImageAction } from "@/app/(app)/camera/actions";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

const POLL = 2000;
type Spot = { x: number; y: number } | null;

export function CameraViewer({ initial, crewName }: Readonly<{ initial: CameraState; crewName: string }>) {
  const { t } = useT();
  const C = t.cam;
  const L = t.camLive;
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial.throws[0]?.id ?? null);
  const [fixing, setFixing] = useState(false);
  const [okd, setOkd] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<Record<string, string | null>>({});

  // Follow the session; jump to a new throw when it comes in.
  useEffect(() => {
    let last = initial.throws[0]?.n ?? 0;
    const id = window.setInterval(() => {
      getCameraStateAction(initial.id)
        .then((st) => {
          setState(st);
          const newest = st.throws[0];
          if (newest && newest.n > last) {
            last = newest.n;
            setOpen(newest.id);
            setFixing(false);
          }
        })
        .catch(() => {});
    }, POLL);
    return () => window.clearInterval(id);
  }, [initial.id, initial.throws]);

  // Fetch the picture of the throw being looked at.
  useEffect(() => {
    if (!open || open in images) return;
    getCameraThrowImageAction(open)
      .then((img) => setImages((m) => ({ ...m, [open]: img })))
      .catch(() => {});
  }, [open, images]);

  const th = state.throws.find((x) => x.id === open);
  const spotText = (s: Spot) => {
    if (!s) return L.noCap;
    const z = spotAt(s);
    if (z.v === "mama") return format(C.mama, { side: z.id === "ML" ? C.left : C.right });
    if (z.v !== null) return format(C.zone, { id: z.id, v: z.v });
    return z.id === "off" ? C.off : C.none;
  };
  function correct(id: string, spot: Spot) {
    setState((st) => ({ ...st, throws: st.throws.map((x) => (x.id === id ? { ...x, spot, corrected: true } : x)) }));
    setFixing(false);
    correctCameraThrowAction(id, spot).catch(() => {});
  }

  const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-gold";
  const secondary = "h-12 rounded-[14px] bg-surface-deep border border-line-strong text-cream font-heading font-extrabold text-base tracking-[0.06em]";

  return (
    <div className="min-h-screen bg-surface w-full max-w-xl mx-auto flex flex-col gap-4 px-5 pt-4.5 pb-10">
      <header className="flex items-center gap-3 h-11">
        <Link href={`/crews/${state.groupId}`} aria-label={t.common.back} className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 flex flex-col min-w-0">
          <span className="font-heading font-bold text-[12px] tracking-[0.14em] text-muted truncate">{crewName.toUpperCase()}</span>
          <h1 className="font-display font-extrabold text-[28px] leading-none uppercase truncate">{format(L.viewTitle, { name: state.cameraName })}</h1>
        </span>
        <span className={cn("px-3 py-1.5 rounded-pill font-heading font-bold text-xs tracking-[0.08em]", state.live ? "bg-red text-cream" : "bg-chip text-muted")}>
          {state.live ? L.liveBadge : L.stopped}
        </span>
      </header>

      {!th && <p className="font-body text-[15px] text-soft">{state.live ? L.viewWaiting : L.viewEnded}</p>}

      {th && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <span className={kicker}>{format(L.throwN, { n: th.n })}</span>
          <MatPick
            src={images[th.id] ?? null}
            spot={th.spot}
            label={fixing ? L.whereSub : spotText(th.spot)}
            onTap={fixing ? (p) => correct(th.id, p) : undefined}
          />
          {fixing ? (
            <>
              <p className="font-body text-[15px] text-soft">{L.whereSub}</p>
              <button type="button" onClick={() => correct(th.id, null)} className={secondary}>
                {L.noCapBtn}
              </button>
              <button type="button" onClick={() => setFixing(false)} className="font-heading font-bold text-[13px] tracking-[0.08em] text-muted py-2">
                {t.common.close}
              </button>
            </>
          ) : (
            <>
              <p className="font-display font-extrabold text-2xl leading-tight">
                {th.corrected ? spotText(th.spot) : th.spot ? format(L.capIn, { where: spotText(th.spot) }) : L.noCapQ}
              </p>
              {th.corrected || okd.has(th.id) ? (
                <button type="button" onClick={() => setFixing(true)} className={secondary}>
                  {L.change}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setOkd((s) => new Set(s).add(th.id))} className="h-12 rounded-[14px] bg-mint text-ink font-heading font-extrabold text-base tracking-[0.06em]">
                    ✓ {L.rightShort}
                  </button>
                  <button type="button" onClick={() => setFixing(true)} className={secondary}>
                    {L.wrong}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {state.throws.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <span className={kicker}>{L.history}</span>
          {state.throws.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-current={x.id === open}
              onClick={() => {
                setOpen(x.id);
                setFixing(false);
              }}
              className={cn("flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] border text-left", x.id === open ? "bg-surface-raised border-gold/50" : "bg-surface-deep border-line")}
            >
              <span className="font-heading font-extrabold text-sm text-gold w-14">{format(C.throwShort, { n: x.n })}</span>
              <span className="flex-1 min-w-0 truncate font-body text-sm">{spotText(x.spot)}</span>
              {x.corrected && <span className="font-heading font-bold text-[11px] tracking-[0.08em] text-muted">{L.fixed}</span>}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
