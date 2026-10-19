"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/** The mat photo at its natural proportions (capped so a tall shot doesn't
 * push the result off screen); tap for full screen. */
export function GamePhoto({ src, alt }: Readonly<{ src: string; alt: string }>) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full bg-black" aria-label={alt}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full h-auto max-h-[60vh] object-contain mx-auto" />
      </button>
      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t.common.close}
          className="fixed inset-0 z-[70] bg-black flex items-center justify-center p-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
        </button>
      )}
    </>
  );
}
