/**
 * RecapSlides
 *
 * Crew season recap as tap-through slides (showed up, blowout, best partner,
 * top scorer, most games, red zone), with a shareable image per slide.
 *
 * Notes: cardContentFor mirrors the on-screen copy for the canvas card;
 * keep both in sync. Copy lives in t.season.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { recapSlideThemes, displayHero, type RecapSlide } from "@/lib/theme/tokens";
import { StatCounter } from "@/components/ui";
import type { RecapData } from "@/lib/db/recap";
import { shareRecapCard, type RecapCardContent } from "@/lib/recap-card";
import { useT } from "@/lib/i18n/client";
import { format, type Dictionary } from "@/lib/i18n";

const ORDER: RecapSlide[] = ["showedUp", "biggestWin", "bestDuo", "topScorer", "mostGames", "redZones"];

/** Mirrors the slide's own JSX content (below) as flat text a canvas can
 * draw — kept in one place so the shared image never drifts from what's
 * on screen. */
function cardContentFor(key: RecapSlide, data: RecapData, crewName: string, S: Dictionary["season"], label: string): RecapCardContent {
  const kicker = `${crewName} · ${label}`;
  switch (key) {
    case "showedUp":
      return {
        kicker,
        headline: S.showedUp,
        bigNumber: String(data.showedUp.games),
        subtext: format(data.showedUp.nights === 1 ? S.acrossOne : S.across, { n: data.showedUp.nights }),
      };
    case "biggestWin":
      return data.biggestWin
        ? {
            kicker,
            headline: `${S.blowout} — ${data.biggestWin.winnerNames}`,
            bigNumber: String(data.biggestWin.margin),
            subtext: format(S.margin, { names: data.biggestWin.loserNames }),
          }
        : { kicker, headline: S.blowout, bigNumber: "–", subtext: S.noGames };
    case "bestDuo":
      return data.bestDuo
        ? {
            kicker,
            headline: `${S.bestPartner} — ${data.bestDuo.names}`,
            bigNumber: String(data.bestDuo.wins),
            subtext: format(S.winsTogether, { w: data.bestDuo.wins, l: data.bestDuo.losses }),
          }
        : { kicker, headline: S.bestPartner, bigNumber: "–", subtext: S.noPartner };
    case "topScorer":
      return data.topScorer
        ? {
            kicker,
            headline: `${S.topScorer} — ${data.topScorer.name}`,
            bigNumber: String(data.topScorer.points),
            subtext: S.pointsSeason,
          }
        : { kicker, headline: S.topScorer, bigNumber: "–", subtext: S.noPoints };
    case "mostGames":
      return data.mostGames
        ? {
            kicker,
            headline: `${S.mostGames} — ${data.mostGames.name}`,
            bigNumber: String(data.mostGames.games),
            subtext: S.gamesPlayed,
          }
        : { kicker, headline: S.mostGames, bigNumber: "–", subtext: S.noGames };
    case "redZones":
      return data.redZones
        ? {
            kicker,
            headline: `${S.redZone} — ${data.redZones.name}`,
            bigNumber: String(data.redZones.count),
            subtext: S.chugs,
          }
        : { kicker, headline: S.redZone, bigNumber: "–", subtext: S.noRed };
  }
}

export function RecapSlides({
  crewId,
  crewName,
  data,
}: Readonly<{ crewId: string; crewName: string; data: RecapData }>) {
  const [index, setIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  const { t } = useT();
  const S = t.season;
  const label = data.label === "All-time" ? S.allTime : data.label;
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
      await shareRecapCard(key, cardContentFor(key, data, crewName, S, label), t.monthly.shareTitle);
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
            style={{ background: theme.text, opacity: i <= index ? 1 : 0.25 }}
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
          {sharing ? "…" : S.share}
        </button>
        <Link
          href={`/crews/${crewId}`}
          aria-label={t.monthly.close}
          className="w-11 h-11 flex items-center justify-center text-3xl leading-none"
          style={{ color: theme.text }}
        >
          ×
        </Link>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center gap-3 pointer-events-none">
        <div className="font-mono font-semibold text-[11px] tracking-[0.2em] uppercase" style={{ color: theme.accent }}>
          {crewName} · {label}
        </div>

        {key === "showedUp" && (
          <>
            <div className="font-body text-lg opacity-85">{S.showedUp}</div>
            <StatCounter value={data.showedUp.games} size={displayHero.seasonRecapStat} />
            <div className="font-body text-lg opacity-85">
              {format(data.showedUp.nights === 1 ? S.acrossOne : S.across, { n: data.showedUp.nights })}
            </div>
          </>
        )}

        {key === "biggestWin" &&
          (data.biggestWin ? (
            <>
              <div className="font-body text-lg opacity-85">{S.blowout}</div>
              <div className="font-display text-3xl">{data.biggestWin.winnerNames}</div>
              <StatCounter value={data.biggestWin.margin} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">{format(S.margin, { names: data.biggestWin.loserNames })}</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">{S.noGames}</div>
          ))}

        {key === "bestDuo" &&
          (data.bestDuo ? (
            <>
              <div className="font-body text-lg opacity-85">{S.bestPartner}</div>
              <div className="font-display text-3xl">{data.bestDuo.names}</div>
              <StatCounter value={data.bestDuo.wins} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">
                {format(S.winsTogether, { w: data.bestDuo.wins, l: data.bestDuo.losses })}
              </div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">{S.noPartner}</div>
          ))}

        {key === "topScorer" &&
          (data.topScorer ? (
            <>
              <div className="font-body text-lg opacity-85">{S.topScorer}</div>
              <div className="font-display text-3xl">{data.topScorer.name}</div>
              <StatCounter value={data.topScorer.points} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">{S.pointsSeason}</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">{S.noPoints}</div>
          ))}

        {key === "mostGames" &&
          (data.mostGames ? (
            <>
              <div className="font-body text-lg opacity-85">{S.mostGames}</div>
              <div className="font-display text-3xl">{data.mostGames.name}</div>
              <StatCounter value={data.mostGames.games} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">{S.gamesPlayed}</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">{S.noGames}</div>
          ))}

        {key === "redZones" &&
          (data.redZones ? (
            <>
              <div className="font-body text-lg opacity-85">{S.redZone}</div>
              <div className="font-display text-3xl">{data.redZones.name}</div>
              <StatCounter value={data.redZones.count} size={displayHero.seasonRecapStat} />
              <div className="font-body text-lg opacity-85">{S.chugs}</div>
            </>
          ) : (
            <div className="font-body text-lg opacity-85">{S.noRed}</div>
          ))}
      </div>

      {/* Tap zones, on top of the (pointer-events-none) content — below the
       * z-10 progress bar / close button, which stay clickable. */}
      <button type="button" aria-label={t.monthly.prevSlide} onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/2" />
      <button type="button" aria-label={t.monthly.nextSlide} onClick={next} className="absolute right-0 top-0 bottom-0 w-1/2" />
    </div>
  );
}
