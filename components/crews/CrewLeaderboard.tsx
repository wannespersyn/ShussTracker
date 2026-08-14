"use client";

import { useState } from "react";
import { AvatarChip, LeaderboardRow } from "@/components/ui";
import type { CapRingColor } from "@/lib/theme/tokens";
import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CrewLeaderboardEntry, CrewRedZoneEntry } from "@/lib/db/crews";

const RING_CYCLE: CapRingColor[] = ["gold", "red", "mint", "cream"];

type Row = { userId: string; name: string; value: number; sub: string };

function toWinRows(entries: CrewLeaderboardEntry[]): Row[] {
  return entries.map((r) => ({
    userId: r.userId,
    name: r.name,
    value: r.wins,
    sub: `${r.gamesPlayed} ${r.gamesPlayed === 1 ? "game" : "games"}`,
  }));
}

function toRedZoneRows(entries: CrewRedZoneEntry[]): Row[] {
  return entries.map((r) => ({
    userId: r.userId,
    name: r.name,
    value: r.chugs,
    sub: `${r.gamesPlayed} ${r.gamesPlayed === 1 ? "game" : "games"}`,
  }));
}

const TABS = [
  { id: "season", label: "Season" },
  { id: "tonight", label: "Tonight" },
  { id: "redZone", label: "Red zone" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function CrewLeaderboard({
  currentUserId,
  season,
  tonight,
  redZone,
}: {
  currentUserId: string;
  season: CrewLeaderboardEntry[];
  tonight: CrewLeaderboardEntry[];
  redZone: CrewRedZoneEntry[];
}) {
  const [tab, setTab] = useState<TabId>("season");

  const rows: Row[] =
    tab === "season" ? toWinRows(season) : tab === "tonight" ? toWinRows(tonight) : toRedZoneRows(redZone);
  const pointsLabel = tab === "redZone" ? "Chugs" : "Points";
  const podium = [rows[1], rows[0], rows[2]].filter((r): r is Row => Boolean(r));
  const rest = rows.slice(3);

  return (
    <div className="flex flex-col gap-3.5">
      {podium.length > 0 && (
        <div className="rounded-xl bg-gradient-hero border-2 border-gold/35 shadow-elevation-lg py-5 px-3.5 flex items-end justify-center gap-4">
          {podium.map((p) => {
            const rank = rows.indexOf(p) + 1;
            const isFirst = rank === 1;
            const ring = RING_CYCLE[(rank - 1) % RING_CYCLE.length];
            return (
              <div key={p.userId} className={cn("flex flex-col items-center gap-1.5", !isFirst && "pb-3.5")}>
                <AvatarChip initials={initialsFor(p.name)} ring={ring} size={isFirst ? 64 : 52} />
                <div className="font-display text-base text-cream">{p.name.split(" ")[0]}</div>
                <div
                  className={cn(
                    "font-heading font-bold text-[13px] tracking-[1.4px]",
                    isFirst ? "text-gold" : "text-cream/55",
                  )}
                >
                  {p.value} {pointsLabel.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 h-10 rounded-md font-heading font-bold text-[13px] tracking-[1.4px] uppercase",
              tab === t.id ? "bg-gold text-surface" : "bg-cream/7 border border-cream/14 text-cream/60",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-6 font-body text-body-sm text-cream/50">No games in this view yet.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rest.map((r) => {
            const rank = rows.indexOf(r) + 1;
            return (
              <LeaderboardRow
                key={r.userId}
                rank={rank}
                initials={initialsFor(r.name)}
                ring={RING_CYCLE[(rank - 1) % RING_CYCLE.length]}
                name={r.name}
                sub={r.sub}
                points={r.value}
                pointsLabel={pointsLabel}
                highlighted={r.userId === currentUserId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
