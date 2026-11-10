/**
 * CameraViewer
 *
 * Follow a crew member's live camera from your own phone (or laptop). While
 * the camera is calibrating, set its corners here on its empty-mat snapshot
 * (so nobody has to touch the camera) or ask it for a new snapshot. Then:
 * the newest throw
 * with its top-down picture and "Cap in zone X?", a tap on "Wrong" to point
 * at the real spot (or say there was no cap), and the list of throws (tap
 * one to fix it later). Fine-tune the zones one by one (ZoneEditor) from
 * here at any time — the camera hangs above the mat, nobody can reach its
 * screen — and follow the linked mat logger's game (CameraLog: log + stats).
 * Polls the session every 2 s; pictures are fetched only for the throw being
 * looked at.
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Pt, ZoneFix } from "@/lib/camera";
import { CornerEditor } from "@/components/camera/CameraLab";
import { ZoneEditor } from "@/components/camera/ZoneEditor";
import { RotateButton, useMatRotation } from "@/components/camera/rotation";
import { CameraLog } from "@/components/camera/CameraLog";
import { asCameraGame, boxLabelsOf, stampEvents } from "@/lib/camera-log";
import type { CameraState } from "@/lib/db/camera";
import { MatPick, ReviewBadge, SpotsEditor, spotsLabel, type Spot } from "@/components/camera/MatPick";
import {
  correctCameraThrowAction,
  getCameraSnapshotAction,
  getCameraStateAction,
  getCameraThrowImageAction,
  requestCameraSnapshotAction,
  setCameraCornersAction,
  setCameraZoneFixAction,
  checkCameraThrowAction,
} from "@/app/(app)/camera/actions";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

const POLL = 2000;

export function CameraViewer({ initial, crewName }: Readonly<{ initial: CameraState; crewName: string }>) {
  const { t } = useT();
  const C = t.cam;
  const L = t.camLive;
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial.throws[0]?.id ?? null);
  const [fixing, setFixing] = useState(false);
  // Throws ticked ✓ here (shown right away; the server has them on the next poll).
  const [okd, setOkd] = useState<Set<string>>(new Set());
  const [onlyTodo, setOnlyTodo] = useState(false);
  // Turn the mat pictures the way you sit (kept on this phone).
  const [rot, turn] = useMatRotation();
  const [images, setImages] = useState<Record<string, string | null>>({});
  // Calibration: the snapshot (per version) and the corners being set.
  const [snap, setSnap] = useState<{ version: number; url: string } | null>(null);
  const [corners, setCorners] = useState<Pt[] | null>(null);
  const [sent, setSent] = useState<"none" | "corners" | "photo">("none");
  // Zone nudges: shared with the camera through the session (versioned).
  const [fix, setFixState] = useState<ZoneFix>(initial.zoneFix?.fix ?? {});
  const fixVersion = useRef(initial.zoneFix?.version ?? 0);
  const fixPush = useRef<number | null>(null);
  const [zonesOpen, setZonesOpen] = useState(false);
  // When each game line was first seen here (the log's order).
  const seenRef = useRef<Record<string, number>>({});
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  const game = state.logger ? asCameraGame(state.game) : null;
  const boxLabels = boxLabelsOf(game);

  function setFix(f: ZoneFix) {
    setFixState(f);
    if (fixPush.current) window.clearTimeout(fixPush.current);
    fixPush.current = window.setTimeout(() => {
      setCameraZoneFixAction(initial.id, f)
        .then((v) => (fixVersion.current = Math.max(fixVersion.current, v)))
        .catch(() => {});
    }, 400);
  }

  // Follow the session; jump to a new throw when it comes in.
  useEffect(() => {
    let last = initial.throws[0]?.n ?? 0;
    const id = window.setInterval(() => {
      getCameraStateAction(initial.id)
        .then((st) => {
          setState(st);
          if (st.zoneFix && st.zoneFix.version > fixVersion.current) {
            fixVersion.current = st.zoneFix.version;
            setFixState(st.zoneFix.fix);
          }
          const g = st.logger ? asCameraGame(st.game) : null;
          if (g && stampEvents(g, seenRef.current)) setSeenAt({ ...seenRef.current });
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

  // Load the snapshot when a new one comes in, starting from the camera's guess
  // (also while watching: the zones are fine-tuned on it).
  const version = state.snap?.version ?? 0;
  useEffect(() => {
    if (!version || snap?.version === version) return;
    getCameraSnapshotAction(initial.id)
      .then((url) => {
        if (!url) return;
        setSnap({ version, url });
        setCorners(state.corners);
        setSent("none");
      })
      .catch(() => {});
  }, [version, snap?.version, initial.id, state.corners]);

  const th = state.throws.find((x) => x.id === open);
  const spotText = (sp: Spot[]) => spotsLabel(sp, C, L);

  const isChecked = (x: { id: string; checked: boolean }) => x.checked || okd.has(x.id);
  const todo = state.throws.filter((x) => !x.corrected && !isChecked(x));
  /** Open the next throw still to check (oldest first), if any. */
  function nextTodo(after: string) {
    const next = [...todo].reverse().find((x) => x.id !== after);
    if (next) {
      setOpen(next.id);
      setFixing(false);
    }
  }
  /** ✓: right as the camera judged it — reviewed, on to the next one. */
  function check(x: { id: string; n: number }) {
    setOkd((s) => new Set(s).add(x.id));
    checkCameraThrowAction(initial.id, x.n).catch(() => {});
    nextTodo(x.id);
  }

  function correct(id: string, spots: Spot[]) {
    setState((st) => ({ ...st, throws: st.throws.map((x) => (x.id === id ? { ...x, spots, corrected: true } : x)) }));
    setFixing(false);
    correctCameraThrowAction(id, spots).catch(() => {});
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
        <RotateButton onClick={turn} label={L.rotate} />
        <span className={cn("px-3 py-1.5 rounded-pill font-heading font-bold text-xs tracking-[0.08em]", state.live ? "bg-red text-cream" : "bg-chip text-muted")}>
          {state.live ? L.liveBadge : L.stopped}
        </span>
      </header>

      {state.live && state.phase === "calibrating" && (
        <section className="flex flex-col gap-3">
          <span className={kicker}>{L.calRemoteKicker}</span>
          {!snap || !corners || !state.snap ? (
            <p className="font-body text-[15px] text-soft">{L.calRemoteWaiting}</p>
          ) : (
            <>
              <p className="font-body text-[15px] leading-normal text-soft">{C.step2Auto}</p>
              <CornerEditor photo={{ url: snap.url, frame: { w: state.snap.w, h: state.snap.h, data: new Uint8ClampedArray(0) } }} corners={corners} onChange={setCorners} labels={C} fix={fix} rot={rot} />
              <button
                type="button"
                disabled={sent !== "none"}
                onClick={() => {
                  setSent("corners");
                  setCameraCornersAction(initial.id, snap.version, corners).catch(() => setSent("none"));
                }}
                className="h-14 rounded-[16px] bg-amber text-ink font-heading font-extrabold text-lg tracking-[0.06em] disabled:opacity-40"
              >
                {sent === "corners" ? L.calRemoteSent : L.go}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={sent === "photo"}
            onClick={() => {
              setSent("photo");
              requestCameraSnapshotAction(initial.id).catch(() => setSent("none"));
            }}
            className={cn(secondary, "disabled:opacity-40")}
          >
            {L.again}
          </button>
        </section>
      )}

      {state.live && snap && state.snap && (state.phase === "watching" ? state.corners : corners) && (
        <section className="flex flex-col gap-3">
          <button type="button" aria-expanded={zonesOpen} onClick={() => setZonesOpen((o) => !o)} className="flex items-center gap-2 text-left py-1">
            <span className={kicker}>{L.zonesTitle}</span>
            {Object.keys(fix).length > 0 && <span className="font-body text-xs text-mint">{format(L.zonesCount, { n: Object.keys(fix).length })}</span>}
            <span className={cn("ml-auto text-muted transition-transform", zonesOpen && "rotate-180")}>▾</span>
          </button>
          {zonesOpen && (
            <>
              <p className="font-body text-[13px] leading-normal text-gold -mt-2">{L.zonesRemoteLive}</p>
              <ZoneEditor
                photo={{ url: snap.url, frame: { w: state.snap.w, h: state.snap.h, data: new Uint8ClampedArray(0) } }}
                corners={(state.phase === "watching" ? state.corners : corners)!}
                fix={fix}
                boxLabels={boxLabels}
                rot={rot}
                onChange={setFix}
              />
            </>
          )}
        </section>
      )}

      {state.phase === "watching" && !th && <p className="font-body text-[15px] text-soft">{state.live ? L.viewWaiting : L.viewEnded}</p>}
      {!state.live && state.phase === "calibrating" && <p className="font-body text-[15px] text-soft">{L.viewEnded}</p>}

      {th && state.phase === "watching" && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <span className={kicker}>{format(L.throwN, { n: th.n })}</span>
          {fixing ? (
            <SpotsEditor key={th.id} src={images[th.id] ?? null} initial={th.spots} gone={th.gone} C={C} L={L} onSave={(sp) => correct(th.id, sp)} onClose={() => setFixing(false)} fix={fix} boxLabels={boxLabels} rot={rot} />
          ) : (
            <>
              <MatPick src={images[th.id] ?? null} spots={th.spots} gone={th.gone} label={spotText(th.spots)} fix={fix} boxLabels={boxLabels} rot={rot} />
              <p className="font-display font-extrabold text-2xl leading-tight">
                {th.corrected ? spotText(th.spots) : th.spots.length ? format(th.spots.length > 1 ? L.capsIn : L.capIn, { where: spotText(th.spots) }) : L.noCapQ}
              </p>
              {th.corrected || th.checked || okd.has(th.id) ? (
                <button type="button" onClick={() => setFixing(true)} className={secondary}>
                  {L.change}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => check(th)} className="h-12 rounded-[14px] bg-mint text-ink font-heading font-extrabold text-base tracking-[0.06em]">
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

      {state.phase === "watching" && <CameraLog game={game} seenAt={seenAt} events={[]} />}

      {state.throws.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className={kicker}>{L.history}</span>
            <span className="font-body text-xs text-muted">{format(L.todoCount, { n: todo.length })}</span>
            <button
              type="button"
              aria-pressed={onlyTodo}
              onClick={() => setOnlyTodo((o) => !o)}
              className={cn("ml-auto h-8 px-3 rounded-pill font-heading font-bold text-xs tracking-[0.06em]", onlyTodo ? "bg-amber text-ink" : "bg-surface-deep border border-line text-soft")}
            >
              {L.onlyTodo}
            </button>
          </div>
          {state.throws.filter((x) => !onlyTodo || (!x.corrected && !isChecked(x))).map((x) => (
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
              <span className="flex-1 min-w-0 truncate font-body text-sm">{spotText(x.spots)}</span>
              <ReviewBadge corrected={x.corrected} checked={isChecked(x)} L={L} />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
