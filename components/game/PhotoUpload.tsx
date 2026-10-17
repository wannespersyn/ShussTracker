"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";

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

export function PhotoUpload({
  action,
  hasPhoto,
  label,
  changeLabel,
}: Readonly<{
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  hasPhoto: boolean;
  label: string;
  changeLabel: string;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const small = await downscale(file).catch(() => file);
    const fd = new FormData();
    fd.append("photo", small);
    start(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error ?? "Upload failed");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} aria-label={label} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        className={cn(
          "h-9 px-3 rounded-pill bg-surface/85 backdrop-blur text-cream font-body font-semibold text-[13px] flex items-center gap-1.5",
          pending && "opacity-60",
        )}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {pending ? "…" : hasPhoto ? changeLabel : label}
      </button>
      {error && <span className="font-body text-xs text-red bg-surface/85 px-2 rounded">{error}</span>}
    </div>
  );
}
