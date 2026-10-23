/**
 * Explainer for turn-by-turn shot tracking. Pops up every
 * time shot tracking is switched on, until the user picks "don't show
 * again" (remembered per device). A small "How?" link reopens it.
 */
"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/client";

const STORAGE_KEY = "shussapp.shotHelpDismissed";

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ShotHelp() {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);

  // Mounted = shot tracking just turned on (or the result step opened with it on).
  useEffect(() => {
    if (!isDismissed()) ref.current?.showModal();
  }, []);

  function close(forever: boolean) {
    if (forever) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* storage blocked — it'll just show again next time */
      }
    }
    ref.current?.close();
  }

  const rows: { icon: string; body: string }[] = [
    { icon: "1·2", body: t.log.helpTurn },
    { icon: "⛨", body: t.log.helpDefense },
    { icon: "+1", body: t.log.helpVak },
    { icon: "↳", body: t.log.helpMoved },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="self-start px-1 font-body font-semibold text-xs text-muted underline underline-offset-2"
      >
        {t.log.helpLink}
      </button>

      <dialog
        ref={ref}
        aria-label={t.log.helpTitle}
        onClick={(e) => {
          if (e.target === e.currentTarget) close(false);
        }}
        className="m-auto w-[min(420px,calc(100vw-32px))] rounded-[22px] bg-surface-raised border border-line text-cream p-0 backdrop:bg-black/60"
      >
        <div className="p-5 flex flex-col gap-4">
          <span className="font-display font-extrabold text-[26px] leading-none uppercase">{t.log.helpTitle}</span>
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <div key={r.icon} className="flex gap-3 items-start">
                <span className="shrink-0 w-9 h-7 rounded-pill bg-surface-panel border border-line text-gold flex items-center justify-center font-heading font-bold text-[12px]">
                  {r.icon}
                </span>
                <span className="font-body text-sm text-cream/90">{r.body}</span>
              </div>
            ))}
          </div>
          <p className="font-body text-xs text-muted">{t.log.helpNote}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => close(true)}
              className="h-11 rounded-md bg-surface-panel border border-line text-cream font-heading font-bold text-[13px] uppercase"
            >
              {t.log.helpHide}
            </button>
            <button
              type="button"
              onClick={() => close(false)}
              className="h-11 rounded-md bg-amber text-ink font-heading font-bold text-[13px] uppercase"
            >
              {t.log.helpOk}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
