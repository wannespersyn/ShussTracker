"use client";

import { useState } from "react";
import Link from "next/link";
import { recapSlideThemes, displayHero, type RecapSlide } from "@/lib/theme/tokens";
import { StatCounter } from "@/components/ui";
import type { RecapData } from "@/lib/db/recap";
import { shareRecapCard, type RecapCardContent } from "@/lib/recap-card";

const ORDER: RecapSlide[] = ["showedUp", "biggestWin", "bestDuo", "topScorer", "mostGames", "redZones"];

/** Mirrors the slide's own JSX content (below) as flat text a canvas can
 * draw — kept in one place so the shared image never drifts from what's
 * on screen. */
function cardContentFor(key: RecapSlide, data: RecapData, crewName: string): RecapCardContent {
  const kicker = `${crewName} · ${data.label}`;
  switch (key) {
    case "showedUp":
      return {
        kicker,
        headline: "The crew showed up",
        bigNumber: String(data.showedUp.games),
        subtext: `games logged, across ${data.showedUp.nights} ${data.showedUp.nights === 1 ? "night" : "nights"}`,
      };
    case "biggestWin":
      return data.biggestWin
        ? {
            kicker,
            headline: `Biggest blowout — ${data.biggestWin.winnerNames}`,
            bigNumber: String(data.biggestWin.margin),
            subtext: `point margin over ${data.biggestWin.loserNames}`,
          }
        : { kicker, headline: "Biggest blowout", bigNumber: "–", subtext: "No games logged yet." };
    case "bestDuo":
      return data.bestDuo
        ? {
            kicker,
            headline: `Best partner — ${data.bestDuo.names}`,
            bigNumber: String(data.bestDuo.wins),
            subtext: `wins together · ${data.bestDuo.wins}–${data.bestDuo.losses}`,
          }
        : { kicker, headline: "Best partner", bigNumber: "–", subtext: "No partner pairing yet." };
    case "topScorer":
      return data.topScorer
        ? {
            kicker,
            headline: `Top scorer — ${data.topScorer.name}`,
            bigNumber: String(data.topScorer.points),
            subtext: "points this season",
          }
        : { kicker, headline: "Top scorer", bigNumber: "–", subtext: "No points logged yet." };
    case "mostGames":
      return data.mostGames
        ? {
            kicker,
            headline: `Most games — ${data.mostGames.name}`,
            bigNumber: String(data.mostGames.games),
            subtext: "games played",
          }
        : { kicker, headline: "Most games", bigNumber: "–", subtext: "No games logged yet." };
    case "redZones":
      return data.redZones
        ? {
            kicker,
            headline: `Red zone regular — ${data.redZones.name}`,
            bigNumber: String(data.redZones.count),
            subtext: "chugs taken",
          }
        : { kicker, headline: "Red zone regular", bigNumber: "–", subtext: "Nobody's hit the red zone yet." };
  }
}

export function RecapSlides({
  crewId,
  crewName,
  data,
}: Readonly<{ crewId: string; crewName: string; data: RecapData }>) {
  const [index, setIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  const key = ORDER[index];
  const theme = recapSlideThemes[key];

  function next() {
    setIndex((i) => Math.min(i + 1, ORDER.length - 1));
  }
  function prev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      await shareRecapCard(key, cardContentFor(key, data, crewName));
    } finally {
      setSharing(false);
    }
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

      <div className="relative z-10 flex items-center justify-end gap-2 mr-5 mt-3">
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="h-9 px-3.5 rounded-pill font-heading font-bold text-[11px] tracking-[1.2px] uppercase disabled:opacity-50"
          style={{ background: theme.buttonBg, color: theme.buttonFg }}
        >
          {sharing ? "…" : "Share"}
        </button>
        <Link
          href={`/crews/${crewId}`}
          aria-label="Close recap"
          className="w-9 h-9 flex items-center justify-center text-2xl leading-none"
        >
          ×
        </Link>
      </div>

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

        {key === "topScorer" &&
          (data.topScorer ? (
            <>
              <div className="font-body text-lg opacity-85">Top scorer</div>
              <div className="font-display text-3xl">{data.topScorer.name}</div>
              <StatCounter value={data.topScorer.points} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">points this season</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">No points logged yet.</div>
          ))}

        {key === "mostGames" &&
          (data.mostGames ? (
            <>
              <div className="font-body text-lg opacity-85">Most games</div>
              <div className="font-display text-3xl">{data.mostGames.name}</div>
              <StatCounter value={data.mostGames.games} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">games played</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">No games logged yet.</div>
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
