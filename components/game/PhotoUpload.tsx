"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

/** Downscale to max 1600px JPEG in the browser before uploading — keeps
 * uploads well under the server-action body limit and Blob storage cheap. */
async function downscale(file: File, max = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82),
  );
  return new File([blob], "mat.jpg", { type: "image/jpeg" });
}

/** Pick (camera or library) → full-screen preview → "Use photo" uploads. */
export function PhotoUpload({
  action,
  hasPhoto,
  label,
  changeLabel,
  useLabel,
  againLabel,
  cancelLabel,
}: Readonly<{
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  hasPhoto: boolean;
  label: string;
  changeLabel: string;
  useLabel: string;
  againLabel: string;
  cancelLabel: string;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPicked({ file, url: URL.createObjectURL(file) });
  }

  function confirm() {
    if (!picked) return;
    const file = picked.file;
    start(async () => {
      const small = await downscale(file).catch(() => file);
      const fd = new FormData();
      fd.append("photo", small);
      const res = await action(fd);
      if (!res.ok) setError(res.error ?? t.errors.uploadFailed);
      else setPicked(null);
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <input ref={input} type="file" accept="image/*" className="sr-only" onChange={onPick} aria-label={label} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="h-9 px-3 rounded-pill bg-[#0b0d0c]/85 backdrop-blur text-[#f3f1ea] font-body font-semibold text-[13px] flex items-center gap-1.5"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {hasPhoto ? changeLabel : label}
        </button>
        {error && !picked && <span className="font-body text-xs text-red bg-surface/85 px-2 rounded">{error}</span>}
      </div>

      {picked && (
        <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picked.url} alt="" className="max-w-full max-h-full object-contain rounded-md" />
          </div>
          {error && <p className="text-center font-body text-sm text-red-pale px-4">{error}</p>}
          <div className="grid grid-cols-[1fr_1fr] gap-2.5 px-5 pt-3" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => input.current?.click()}
              className="h-13 rounded-lg border-2 border-[#f3f1ea]/40 text-[#f3f1ea] font-heading font-extrabold text-base tracking-[0.06em] uppercase"
            >
              {againLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirm}
              className={cn("h-13 rounded-lg bg-amber text-ink font-heading font-extrabold text-base tracking-[0.06em] uppercase", pending && "opacity-70")}
            >
              {pending ? "…" : useLabel}
            </button>
            <button type="button" disabled={pending} onClick={() => setPicked(null)} className="col-span-2 h-10 font-body font-semibold text-sm text-[#9aa19c]">
              {cancelLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
