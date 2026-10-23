/**
 * Renders the Wrapped share card (1080×1920, story format) on a canvas and
 * shares it as an image via the Web Share API, falling back to a download.
 * Client-only.
 */
export type WrappedCardContent = {
  kicker: string;
  name: string;
  rankLine: string;
  typeLabel: string;
  typeName: string;
  stats: { label: string; value: string }[];
  partnersLabel: string;
  partners: string[];
  footer: string;
};

const W = 1080;
const H = 1920;
const INK = "#111111";
const GOLD = "#ffb627";

function font(weight: number, size: number, family = "Barlow Condensed") {
  return `${weight} ${size}px "${family}", "Arial Narrow", sans-serif`;
}

export function drawWrappedCard(canvas: HTMLCanvasElement, c: WrappedCardContent) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  // Card
  const x = 72;
  const y = 120;
  const w = W - 144;
  const h = H - 240;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 56);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.textBaseline = "top";
  ctx.font = font(700, 40);
  ctx.fillText(c.kicker, x + 64, y + 72);
  ctx.font = font(800, 220);
  ctx.fillText(c.name.toUpperCase(), x + 56, y + 130);
  ctx.font = font(600, 44, "Barlow");
  ctx.fillText(c.rankLine, x + 64, y + 370);

  // Play style block
  ctx.beginPath();
  ctx.roundRect(x + 56, y + 470, w - 112, 250, 36);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.font = font(700, 36);
  ctx.fillText(c.typeLabel, x + 100, y + 510);
  ctx.font = font(800, 100);
  ctx.fillText(c.typeName.toUpperCase(), x + 96, y + 565, w - 200);

  // Stats grid 2×2
  ctx.fillStyle = INK;
  c.stats.slice(0, 4).forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = x + 64 + col * ((w - 128) / 2);
    const sy = y + 790 + row * 230;
    ctx.fillRect(sx, sy, (w - 128) / 2 - 24, 5);
    ctx.font = font(700, 34);
    ctx.fillText(s.label, sx, sy + 30);
    ctx.font = font(800, 120);
    ctx.fillText(s.value, sx, sy + 72);
  });

  ctx.fillRect(x + 64, y + 1260, w - 128, 5);
  ctx.font = font(700, 34);
  ctx.fillText(c.partnersLabel, x + 64, y + 1290);
  ctx.font = font(700, 56, "Barlow");
  ctx.fillText(c.partners.join(" · "), x + 64, y + 1345, w - 128);

  ctx.font = font(700, 36);
  ctx.fillText(c.footer, x + 64, y + h - 100);
  return true;
}

export async function shareWrappedCard(c: WrappedCardContent, opts: { download?: boolean } = {}): Promise<"shared" | "downloaded" | "failed"> {
  try {
    await document.fonts?.ready;
  } catch {
    // fonts API unavailable: draw with fallbacks
  }
  const canvas = document.createElement("canvas");
  if (!drawWrappedCard(canvas, c)) return "failed";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], "shussapp-wrapped.png", { type: "image/png" });
  if (!opts.download && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Shussapp Wrapped" });
    } catch {
      // cancelled share sheet
    }
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shussapp-wrapped.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
