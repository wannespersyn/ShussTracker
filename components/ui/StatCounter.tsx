import { cn } from "@/lib/cn";

const STRIP_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function DigitStrip({ digit, durationMs }: { digit: string; durationMs: number }) {
  // Strip scrolls through 0-9 and lands on the target digit (11th slot) —
  // the `roll` keyframe (app/globals.css) translates exactly -10em.
  const strip = [...STRIP_DIGITS, digit];
  return (
    <div className="relative overflow-hidden" style={{ height: "1em" }}>
      <div className="animate-roll" style={{ animationDuration: `${durationMs}ms` }}>
        {strip.map((d, i) => (
          <div key={i} style={{ height: "1em", lineHeight: "1em" }}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

type StatCounterProps = {
  value: number | string;
  /** Font size in px — display-hero numbers are one-off per screen, see
   * lib/theme/tokens.ts `displayHero`. */
  size?: number;
  durationMs?: number;
  className?: string;
};

/** Rolling scoreboard counter — the signature "big stat" treatment. */
export function StatCounter({ value, size = 46, durationMs = 1600, className }: StatCounterProps) {
  const chars = String(value).split("");

  return (
    <div className={cn("flex items-baseline font-display font-extrabold tabular-nums", className)} style={{ fontSize: size, lineHeight: 1 }}>
      {chars.map((char, i) =>
        /[0-9]/.test(char) ? (
          <DigitStrip key={i} digit={char} durationMs={durationMs} />
        ) : (
          <span key={i}>{char}</span>
        ),
      )}
    </div>
  );
}
