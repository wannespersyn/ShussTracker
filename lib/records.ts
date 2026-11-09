/**
 * Crew records
 *
 * Replays a crew's history and returns every moment a record fell: a new
 * longest win streak, most mamas in one game, or someone taking over the
 * top of the all-time mamas (adjes) or kruipen boards. Shown in the crew
 * feed; derived on the fly, so it's always consistent with the games.
 *
 * Data: InsightGame[] (crew history) in, record events out, newest first.
 */
import type { InsightGame } from "@/lib/insights";

export type RecordKind = "streak" | "mamaGame" | "mamaLeader" | "kruipLeader";
export type RecordEvent = { kind: RecordKind; userId: string; value: number; previous: number; previousHolder: string | null; at: Date; gameId: string };

/** Minimum value before a record is worth a feed item (early-season noise otherwise). */
export const RECORD_MIN: Record<RecordKind, number> = { streak: 4, mamaGame: 3, mamaLeader: 10, kruipLeader: 3 };

export function crewRecords(games: InsightGame[]): RecordEvent[] {
  const out: RecordEvent[] = [];
  const run = new Map<string, number>();
  const mamas = new Map<string, number>();
  const kruipen = new Map<string, number>();
  const best: Record<RecordKind, { v: number; holder: string | null }> = {
    streak: { v: 0, holder: null },
    mamaGame: { v: 0, holder: null },
    mamaLeader: { v: 0, holder: null },
    kruipLeader: { v: 0, holder: null },
  };
  // Leader boards announce a holder once (when they take over, or first reach the minimum).
  const announced: Partial<Record<RecordKind, string>> = {};
  // A record streak gets one event that grows while the streak goes on.
  const liveStreak = new Map<string, RecordEvent>();
  const consider = (kind: RecordKind, userId: string, value: number, g: InsightGame) => {
    const b = best[kind];
    if (value <= b.v) return;
    const prev = { v: b.v, holder: b.holder };
    best[kind] = { v: value, holder: userId };
    if (value < RECORD_MIN[kind]) return;
    if (kind === "streak") {
      const ev = liveStreak.get(userId);
      if (ev) {
        ev.value = value;
        return;
      }
    }
    if ((kind === "mamaLeader" || kind === "kruipLeader") && announced[kind] === userId) return;
    const ev: RecordEvent = { kind, userId, value, previous: prev.v, previousHolder: prev.holder, at: g.playedAt, gameId: g.id };
    out.push(ev);
    if (kind === "streak") liveStreak.set(userId, ev);
    if (kind === "mamaLeader" || kind === "kruipLeader") announced[kind] = userId;
  };

  for (const g of [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())) {
    const teams = g.teams.filter((t) => t.rank != null && t.players.length > 0);
    if (teams.length < 2) continue;
    const top = Math.min(...teams.map((t) => t.rank!));
    for (const t of teams) {
      const won = t.rank === top;
      for (const p of t.players) {
        const r = won ? (run.get(p.id) ?? 0) + 1 : 0;
        run.set(p.id, r);
        if (won) consider("streak", p.id, r, g);
        else liveStreak.delete(p.id);
        consider("mamaGame", p.id, p.mama, g);
        mamas.set(p.id, (mamas.get(p.id) ?? 0) + p.mama);
        consider("mamaLeader", p.id, mamas.get(p.id)!, g);
        if (!won && t.kruip) {
          kruipen.set(p.id, (kruipen.get(p.id) ?? 0) + 1);
          consider("kruipLeader", p.id, kruipen.get(p.id)!, g);
        }
      }
    }
  }
  return out.reverse();
}
