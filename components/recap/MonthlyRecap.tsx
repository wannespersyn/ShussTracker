"use client";

import Link from "next/link";
import { useState } from "react";
import type { RecapStory } from "@/lib/monthly-recap";

const TONES: Record<RecapStory["tone"], { bg: string; fg: string }> = {
  amber: { bg: "#ffb627", fg: "#111111" },
  ink: { bg: "#0b0d0c", fg: "#f3f1ea" },
  panel: { bg: "#15191a", fg: "#f3f1ea" },
  red: { bg: "#ff6b5b", fg: "#111111" },
};

/** Instagram-story style monthly recap (mockup "Monthly recap (story)"). */
export function MonthlyRecap({ slides, crewName, closeHref }: Readonly<{ slides: RecapStory[]; crewName: string; closeHref: string }>) {
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const s = slides[i];
  const tone = TONES[s.tone];
  const last = i === slides.length - 1;

  async function share() {
    const result = await shareStory(s, crewName);
    setStatus(result === "downloaded" ? "Saved — post it from your photos" : null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ background: tone.bg, color: tone.fg, transition: "background-color 220ms ease" }}
    >
      <div className="w-full max-w-md h-full flex flex-col gap-2.5 px-5.5 pt-3.5" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom))" }}>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }}>
          {slides.map((_, k) => (
            <div key={k} className="h-1 rounded-[2px]" style={{ background: "currentColor", opacity: k <= i ? 1 : 0.25 }} />
          ))}
        </div>
        <div className="flex justify-between items-center">
          <span className="font-heading font-extrabold text-base tracking-[0.1em] uppercase">SHUSSAPP · {crewName}</span>
          <Link href={closeHref} aria-label="Close recap" className="w-11 h-11 flex items-center justify-center" style={{ color: tone.fg }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        </div>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => setI((k) => Math.min(slides.length - 1, k + 1))}
          className="flex-1 flex flex-col justify-center gap-3.5 text-left"
          style={{ color: tone.fg }}
        >
          <span className="font-heading font-bold text-lg tracking-[0.16em] opacity-75">{s.kicker}</span>
          <span className="font-display font-extrabold leading-[0.9]!" style={{ fontSize: s.bigSize }}>
            {s.big}
          </span>
          <span className="font-heading font-bold text-[32px] leading-[1.05]! whitespace-pre-line">{s.line}</span>
          <span className="font-body text-base leading-[1.4]! opacity-80">{s.foot}</span>
        </button>
        {status && <span className="text-center font-body text-sm opacity-80">{status}</span>}
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <button
            type="button"
            onClick={() => setI((k) => Math.max(0, k - 1))}
            className="h-13.5 rounded-lg border-2 font-heading font-extrabold text-lg tracking-[0.08em]"
            style={{ borderColor: tone.fg, color: tone.fg }}
          >
            BACK
          </button>
          <button
            type="button"
            onClick={() => (last ? share() : setI((k) => k + 1))}
            className="h-13.5 rounded-lg font-heading font-extrabold text-lg tracking-[0.08em]"
            style={{ background: tone.fg, color: tone.bg }}
          >
            {last ? "SHARE TO STORY" : "NEXT"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Draws the slide as a 1080×1920 story image and opens the share sheet
 * (falls back to a download where file sharing isn't supported). */
async function shareStory(s: RecapStory, crewName: string): Promise<"shared" | "downloaded" | "failed"> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "failed";
  const tone = TONES[s.tone];
  const root = getComputedStyle(document.documentElement);
  const cond = root.getPropertyValue("--font-barlow-condensed").trim() || "sans-serif";
  const body = root.getPropertyValue("--font-barlow").trim() || "sans-serif";
  await document.fonts?.ready;

  ctx.fillStyle = tone.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = tone.fg;
  ctx.textBaseline = "alphabetic";
  const x = 96;
  ctx.font = `800 44px ${cond}`;
  ctx.fillText(`SHUSSAPP · ${crewName.toUpperCase()}`, x, 170);
  ctx.globalAlpha = 0.75;
  ctx.font = `700 52px ${cond}`;
  ctx.fillText(s.kicker, x, 640);
  ctx.globalAlpha = 1;
  ctx.font = `800 ${Math.round(s.bigSize * 2.7)}px ${cond}`;
  ctx.fillText(s.big, x - 8, 640 + s.bigSize * 2.5);
  let y = 640 + s.bigSize * 2.5 + 130;
  ctx.font = `700 88px ${cond}`;
  for (const line of s.line.split("\n")) {
    ctx.fillText(line, x, y);
    y += 92;
  }
  ctx.globalAlpha = 0.8;
  ctx.font = `400 44px ${body}`;
  y += 30;
  for (const line of wrap(ctx, s.foot, W - 2 * x)) {
    ctx.fillText(line, x, y);
    y += 60;
  }
  ctx.globalAlpha = 1;

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], "shussapp-recap.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Shussapp recap" });
    } catch {
      /* closed */
    }
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shussapp-recap.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > max && cur) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
