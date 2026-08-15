"use client";

import { useState } from "react";
import Link from "next/link";
import { recapSlideThemes, displayHero, type RecapSlide } from "@/lib/theme/tokens";
import { StatCounter } from "@/components/ui";
import type { RecapData } from "@/lib/db/recap";

const ORDER: RecapSlide[] = ["showedUp", "biggestWin", "bestDuo", "redZones"];

export function RecapSlides({
  crewId,
  crewName,
  data,
}: Readonly<{ crewId: string; crewName: string; data: RecapData }>) {
  const [index, setIndex] = useState(0);
  const key = ORDER[index];
  const theme = recapSlideThemes[key];

  function next() {
    setIndex((i) => Math.min(i + 1, ORDER.length - 1));
  }
  function prev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: theme.background, color: theme.text }}>
      <div className="relative z-10 flex gap-1.5 px-5 pt-14">
        {ORDER.map((k, i) => (
          <div
            key={k}
            className="flex-1 h-1 rounded-pill"
            style={{ background: i <= index ? theme.accent : "rgba(255,255,255,.25)" }}
          />
        ))}
      </div>

      <Link
        href={`/crews/${crewId}`}
        aria-label="Close recap"
        className="relative z-10 self-end mr-5 mt-3 w-9 h-9 flex items-center justify-center text-2xl leading-none"
      >
        ×
      </Link>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center gap-3 pointer-events-none">
        <div className="font-mono font-semibold text-[11px] tracking-[0.2em] uppercase" style={{ color: theme.accent }}>
          {crewName} · {data.label}
        </div>

        {key === "showedUp" && (
          <>
            <div className="font-body text-lg opacity-85">The crew showed up</div>
            <StatCounter value={data.showedUp.games} size={displayHero.seasonRecapStat} />
            <div className="font-body text-lg opacity-85">
              games logged, across {data.showedUp.nights} {data.showedUp.nights === 1 ? "night" : "nights"}
            </div>
          </>
        )}

        {key === "biggestWin" &&
          (data.biggestWin ? (
            <>
              <div className="font-body text-lg opacity-85">Biggest blowout</div>
              <div className="font-display text-3xl">{data.biggestWin.winnerNames}</div>
              <StatCounter value={data.biggestWin.margin} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">point margin over {data.biggestWin.loserNames}</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">No games logged yet.</div>
          ))}

        {key === "bestDuo" &&
          (data.bestDuo ? (
            <>
              <div className="font-body text-lg opacity-85">Best partner</div>
              <div className="font-display text-3xl">{data.bestDuo.names}</div>
              <StatCounter value={data.bestDuo.wins} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">
                wins together · {data.bestDuo.wins}–{data.bestDuo.losses}
              </div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">No partner pairing yet.</div>
          ))}

        {key === "redZones" &&
          (data.redZones ? (
            <>
              <div className="font-body text-lg opacity-85">Red zone regular</div>
              <div className="font-display text-3xl">{data.redZones.name}</div>
              <StatCounter value={data.redZones.count} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">chugs taken</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">Nobody&apos;s hit the red zone yet.</div>
          ))}
      </div>

      {/* Tap zones, on top of the (pointer-events-none) content — below the
       * z-10 progress bar / close button, which stay clickable. */}
      <button type="button" aria-label="Previous slide" onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/2" />
      <button type="button" aria-label="Next slide" onClick={next} className="absolute right-0 top-0 bottom-0 w-1/2" />
    </div>
  );
}
