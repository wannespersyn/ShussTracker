"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { cn } from "@/lib/cn";

type RosterPlayer = { id: string; name: string };

/** Side A / Side B player pickers for pinning a rivalry — solo (1 a side)
 * or duo (2 a side), never mixed. A player picked on one side is disabled
 * on the other so the two sides can't overlap. */
export function PinRivalryForm({
  roster,
  action,
}: Readonly<{ roster: RosterPlayer[]; action: (formData: FormData) => void }>) {
  const [mode, setMode] = useState<"solo" | "duo">("solo");
  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);

  const limit = mode === "duo" ? 2 : 1;

  function switchMode(next: "solo" | "duo") {
    setMode(next);
    setSideA([]);
    setSideB([]);
  }

  function toggle(side: "a" | "b", id: string) {
    const setSide = side === "a" ? setSideA : setSideB;
    setSide((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= limit) return prev;
      return [...prev, id];
    });
  }

  const canSubmit = sideA.length === limit && sideB.length === limit;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="aPlayer1" value={sideA[0] ?? ""} />
      <input type="hidden" name="aPlayer2" value={sideA[1] ?? ""} />
      <input type="hidden" name="bPlayer1" value={sideB[0] ?? ""} />
      <input type="hidden" name="bPlayer2" value={sideB[1] ?? ""} />

      <div className="flex gap-1.5 bg-surface-deep rounded-pill p-1">
        <button
          type="button"
          onClick={() => switchMode("solo")}
          className={cn(
            "flex-1 h-9 rounded-pill font-heading font-semibold text-[11.5px] tracking-[0.06em] uppercase",
            mode === "solo" ? "bg-gold text-ink" : "text-cream/50",
          )}
        >
          Player vs player
        </button>
        <button
          type="button"
          onClick={() => switchMode("duo")}
          className={cn(
            "flex-1 h-9 rounded-pill font-heading font-semibold text-[11.5px] tracking-[0.06em] uppercase",
            mode === "duo" ? "bg-gold text-ink" : "text-cream/50",
          )}
        >
          Duo vs duo
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
          Side A{mode === "duo" ? ` (${sideA.length}/2)` : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          {roster.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={sideB.includes(p.id)}
              onClick={() => toggle("a", p.id)}
              className={cn(
                "px-4 h-11 rounded-md font-heading font-bold text-sm disabled:opacity-25",
                sideA.includes(p.id) ? "bg-gold text-ink" : "bg-cream/8 text-cream/70",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
          Side B{mode === "duo" ? ` (${sideB.length}/2)` : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          {roster.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={sideA.includes(p.id)}
              onClick={() => toggle("b", p.id)}
              className={cn(
                "px-4 h-11 rounded-md font-heading font-bold text-sm disabled:opacity-25",
                sideB.includes(p.id) ? "bg-red text-cream" : "bg-cream/8 text-cream/70",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <PrimaryButton type="submit" className="mt-auto h-16 w-full" size="lg" disabled={!canSubmit}>
        Pin this beef
      </PrimaryButton>
    </form>
  );
}
