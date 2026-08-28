import { recapSlideThemes, type RecapSlide } from "@/lib/theme/tokens";

export type RecapCardContent = {
  kicker: string;
  headline: string;
  bigNumber: string;
  subtext: string;
};

const CARD_SIZE = 1080;

const GRADIENT_STOPS: Record<RecapSlide, { kind: "radial" | "linear"; colors: string[] }> = {
  showedUp: { kind: "radial", colors: ["#14201A", "#0B0F0C", "#0A0C0A"] },
  biggestWin: { kind: "radial", colors: ["#6B1712", "#2C0A08", "#0A0C0A"] },
  bestDuo: { kind: "linear", colors: ["#E8B33C", "#C9992F", "#14201A", "#0B0F0C"] },
  redZones: { kind: "radial", colors: ["#14201A", "#0B0F0C", "#0A0C0A"] },
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}

/** Draws a square, WhatsApp-friendly recap card matching the on-screen
 * slide's theme (lib/theme/tokens.ts's `recapSlideThemes`) — a from-scratch
 * canvas redraw rather than a DOM screenshot, since it needs no extra
 * dependency and renders identically regardless of device pixel ratio or
 * font-loading timing. */
function drawCard(canvas: HTMLCanvasElement, slide: RecapSlide, content: RecapCardContent): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const size = CARD_SIZE;

  const theme = recapSlideThemes[slide];
  const stops = GRADIENT_STOPS[slide];
  const gradient =
    stops.kind === "radial"
      ? ctx.createRadialGradient(size / 2, 0, 0, size / 2, 0, size * 1.15)
      : ctx.createLinearGradient(size * 0.1, 0, size * 0.9, size);
  stops.colors.forEach((c, i) => gradient.addColorStop(i / (stops.colors.length - 1), c));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = theme.accent;
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(content.kicker.toUpperCase(), size / 2, 150);

  ctx.fillStyle = theme.text;
  ctx.font = "500 36px system-ui, sans-serif";
  ctx.fillText(content.headline, size / 2, size / 2 - 170);

  ctx.font = "800 180px system-ui, sans-serif";
  ctx.fillText(content.bigNumber, size / 2, size / 2 + 40);

  ctx.font = "500 34px system-ui, sans-serif";
  wrapText(ctx, content.subtext, size / 2, size / 2 + 130, size - 200, 44);

  ctx.fillStyle = theme.accent;
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText("SHUSSAPP", size / 2, size - 90);

  return true;
}

/** Renders and shares a recap card via the Web Share API (so it lands as an
 * actual image attachment in WhatsApp, not a link) when the platform
 * supports sharing files, falling back to a plain download otherwise. */
export async function shareRecapCard(
  slide: RecapSlide,
  content: RecapCardContent,
): Promise<"shared" | "downloaded" | "failed"> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  if (!drawCard(canvas, slide, content)) return "failed";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return "failed";

  const file = new File([blob], "shussapp-recap.png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Shussapp recap" });
      return "shared";
    } catch {
      // AbortError from a cancelled share sheet isn't a failure worth a
      // fallback download — the user just closed it.
      return "shared";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shussapp-recap.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
