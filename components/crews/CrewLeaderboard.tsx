"use client";

import { useState } from "react";
import { AvatarChip, InfoButton, LeaderboardRow } from "@/components/ui";
import type { CapRingColor } from "@/lib/theme/tokens";
import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CrewEloEntry, CrewLeaderboardEntry, CrewRedZoneEntry } from "@/lib/db/crews";
import { ELO_BASE } from "@/lib/elo";

const RING_CYCLE: CapRingColor[] = ["gold", "red", "mint", "cream"];

type Row = { userId: string; name: string; value: number; display: string; sub: string };

function toWinRows(entries: CrewLeaderboardEntry[]): Row[] {
  return entries.map((r) => ({
    userId: r.userId,
    name: r.name,
    value: r.wins,
    display: r.gamesPlayed > 0 ? `${Math.round((r.wins / r.gamesPlayed) * 100)}%` : "0%",
    sub: `${r.gamesPlayed} ${r.gamesPlayed === 1 ? "game" : "games"}`,
  }));
}

function toRedZoneRows(entries: CrewRedZoneEntry[]): Row[] {
  return entries.map((r) => ({
    userId: r.userId,
    name: r.name,
    value: r.chugs,
    display: String(r.chugs),
    sub: `${r.gamesPlayed} ${r.gamesPlayed === 1 ? "game" : "games"}`,
  }));
}

function toEloRows(entries: CrewEloEntry[]): Row[] {
  return entries.map((r) => ({
    userId: r.userId,
    name: r.name,
    value: r.rating,
    display: String(r.rating),
    sub: `${r.gamesPlayed} ${r.gamesPlayed === 1 ? "game" : "games"}`,
  }));
}

const TABS = [
  { id: "season", label: "Season" },
  { id: "elo", label: "Elo" },
  { id: "tonight", label: "Tonight" },
  { id: "redZone", label: "Red zone" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TAB_INFO: Record<TabId, { ariaLabel: string; body: string; example: string }> = {
  season: {
    ariaLabel: "How Season rank works",
    body: "Ranked by win rate across every game — but a bigger sample counts more, so a lucky hot streak can't jump ahead of a proven track record.",
    example: "1 win from 1 game ranks below 15 wins from 20 games, even though 100% beats 75% on paper. Play more to lock in your spot.",
  },
  elo: {
    ariaLabel: "How Elo rank works",
    body: `Ranked by Elo, not just win rate — beating a strong player gains you more than beating a weak one, and losing to a weak player costs you more than losing to a strong one. Everyone starts at ${ELO_BASE}.`,
    example: "You're rated 1000. Beat a 1200-rated player and you'd gain roughly 36 points. Beat an 800-rated player instead and you'd only gain about 12 — you were expected to win anyway.",
  },
  tonight: {
    ariaLabel: "How Tonight rank works",
    body: "Same win-rate ranking as Season, but scoped to only the games played today — it resets every night so anyone can take the top spot.",
    example: "2-0 tonight ranks above 1-0 tonight, even if that player is way ahead on the Season tab.",
  },
  redZone: {
    ariaLabel: "How Red zone rank works",
    body: "Ranked by total chugs — how many times you've hit the risk-zone \"mama\" shot and had to drink. Most chugs takes the top spot.",
    example: "Hit the mama shot 3 times across tonight's games and you rank above someone who's hit it twice, no matter how many games either of you played.",
  },
};

export function CrewLeaderboard({
  currentUserId,
  season,
  tonight,
  redZone,
  elo,
}: {
  currentUserId: string;
  season: CrewLeaderboardEntry[];
  tonight: CrewLeaderboardEntry[];
  redZone: CrewRedZoneEntry[];
  elo: CrewEloEntry[];
}) {
  const [tab, setTab] = useState<TabId>("season");

  const rows: Row[] =
    tab === "season"
      ? toWinRows(season)
      : tab === "tonight"
        ? toWinRows(tonight)
        : tab === "elo"
          ? toEloRows(elo)
          : toRedZoneRows(redZone);
  const pointsLabel = tab === "redZone" ? "Chugs" : tab === "elo" ? "Elo" : "Win %";
  const leader = rows[0];
  const own = rows.find((r) => r.userId === currentUserId);
  const ownRank = own ? rows.indexOf(own) + 1 : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-1.5 bg-surface-deep rounded-pill p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 h-9 rounded-pill font-heading font-semibold text-[11.5px] tracking-[0.06em] uppercase",
              tab === t.id ? "bg-gold text-ink" : "text-cream/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-6 font-body text-body-sm text-cream/50">No games in this view yet.</div>
      ) : (
        <>
          {leader && (
            <div className="rounded-xl bg-gradient-alt border border-gold/20 py-4 px-3.5 flex items-center gap-3.5">
              <AvatarChip initials={initialsFor(leader.name)} ring="gold" size={62} elevated />
              <div className="flex-1 min-w-0">
                <div className="font-mono font-medium text-[9.5px] tracking-widest text-gold">
                  {tab === "redZone" ? "MOST CHUGS" : tab === "elo" ? "TOP RATED" : "KING OF THE MAT"}
                </div>
                <div className="font-display text-[26px] leading-[1.05] text-cream truncate mt-1">
                  {leader.name}
                </div>
                <div className="font-mono text-[11px] text-cream/50 mt-1">
                  {leader.display} · {leader.sub}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 px-3">
            <div className="flex items-center font-mono font-medium text-[9px] tracking-widest text-cream/35">
              <span className="w-6.5">RANK</span>
              <span className="flex-1">PLAYER</span>
              <span className="flex items-center gap-1">
                {pointsLabel.toUpperCase()}
                <InfoButton ariaLabel={TAB_INFO[tab].ariaLabel}>
                  <p>{TAB_INFO[tab].body}</p>
                  <p className="mt-2.5">
                    <span className="text-cream/45">Example: </span>
                    {TAB_INFO[tab].example}
                  </p>
                </InfoButton>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.75">
            {rows.map((r, i) => (
              <LeaderboardRow
                key={r.userId}
                href={`/players/${r.userId}`}
                rank={i + 1}
                initials={initialsFor(r.name)}
                ring={RING_CYCLE[i % RING_CYCLE.length]}
                name={r.name}
                sub={r.sub}
                points={r.display}
                pointsLabel={pointsLabel}
                highlighted={r.userId === currentUserId}
              />
            ))}
          </div>

          {own && ownRank && ownRank > 3 && (
            <div className="flex items-center bg-linear-to-r from-gold/12 to-surface-deep border-[1.5px] border-gold rounded-lg px-3 py-2.75">
              <span className="w-9 font-mono font-semibold text-body text-gold">{ownRank}</span>
              <AvatarChip initials={initialsFor(own.name)} ring="gold" size={32} className="mr-2.75" />
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-body-sm text-cream truncate">You · {own.name}</div>
                <div className="font-mono text-[9.5px] text-cream/45 mt-0.5">{own.sub}</div>
              </div>
              <span className="font-mono font-semibold text-body-sm text-gold">{own.display}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
