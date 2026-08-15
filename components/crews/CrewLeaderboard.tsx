"use client";

import { useState } from "react";
import { AvatarChip, LeaderboardRow } from "@/components/ui";
import { InfoIcon } from "@/components/ui/icons";
import type { CapRingColor } from "@/lib/theme/tokens";
import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CrewLeaderboardEntry, CrewRedZoneEntry } from "@/lib/db/crews";

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
  const [rankInfoOpen, setRankInfoOpen] = useState(false);

  const rows: Row[] =
    tab === "season" ? toWinRows(season) : tab === "tonight" ? toWinRows(tonight) : toRedZoneRows(redZone);
  const pointsLabel = tab === "redZone" ? "Chugs" : "Win %";
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
                  {tab === "redZone" ? "MOST CHUGS" : "KING OF THE MAT"}
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
                {tab !== "redZone" && (
                  <button
                    type="button"
                    onClick={() => setRankInfoOpen((v) => !v)}
                    aria-expanded={rankInfoOpen}
                    aria-label="How win % rank works"
                    className={rankInfoOpen ? "text-gold" : "text-cream/35"}
                  >
                    <InfoIcon className="w-3 h-3" />
                  </button>
                )}
              </span>
            </div>
            {rankInfoOpen && tab !== "redZone" && (
              <div className="font-body text-[11.5px] leading-[1.4] text-cream/55">
                Ranked by win rate, but a bigger sample counts more — a lucky 1–0 won&apos;t jump ahead of a steady
                27–3. Play more to trust your rank.
              </div>
            )}
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
