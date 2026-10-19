"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { ACHIEVEMENT_ICON_PATH, type AchievementCat, type AchievementV2 } from "@/lib/achievements-v2";


export function AchievementGrid({ items }: Readonly<{ items: AchievementV2[] }>) {
  const [cat, setCat] = useState<AchievementCat>("streak");
  const { t } = useT();
  const CATS: [AchievementCat, string][] = [
    ["streak", t.ach.streaks],
    ["games", t.ach.games],
    ["shots", t.ach.mama],
    ["social", t.ach.social],
  ];
  return (
    <>
      <div role="tablist" aria-label={t.ach.category} className="flex gap-1.5">
        {CATS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={cat === id}
            onClick={() => setCat(id)}
            className={cn(
              "flex-1 h-9.5 rounded-[10px] font-heading font-bold text-sm tracking-[0.08em]",
              cat === id ? "bg-amber text-ink" : "bg-surface-deep text-muted border border-line",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items
          .filter((a) => a.cat === cat)
          .map((a) => {
            const pct = Math.round(Math.min(1, a.have / a.need) * 100);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex flex-col gap-1.5 p-3.5 rounded-[16px] border",
                  a.got ? "bg-surface-raised border-gold/40" : "bg-surface-deep border-cream/6",
                )}
              >
                <span className={cn("w-10.5 h-10.5 rounded-md flex items-center justify-center", a.got ? "bg-amber text-ink" : "bg-chip text-[#6b746f]")}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
                    <path d={ACHIEVEMENT_ICON_PATH[a.icon]} />
                  </svg>
                </span>
                <span className="font-heading font-bold text-lg leading-[1.05]!">{a.name}</span>
                <span className="font-body text-xs leading-[1.3]! text-muted">{a.desc}</span>
                <div className="h-1.25 rounded-[3px] bg-chip overflow-hidden">
                  <div className={cn("h-full", a.got ? "bg-amber" : "bg-[#6b746f]")} style={{ width: `${pct}%` }} />
                </div>
                <span className={cn("font-body font-bold text-[11px] tracking-[0.06em]", a.got ? "text-gold" : "text-muted")}>
                  {a.got ? t.ach.unlocked : `${Math.min(a.have, a.need)} / ${a.need}`}
                </span>
              </div>
            );
          })}
      </div>
    </>
  );
}
