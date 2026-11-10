/**
 * Crew events
 *
 * One list of a crew's tournaments of both kinds — fixed-duo brackets and
 * Americano / Mexicano rotations — newest first, with who won the finished
 * ones. Used by the crew page and the crew's tournaments page.
 */
import { getGroupTournaments, getTournament, type TournamentFormat } from "@/lib/db/tournaments";
import { getGroupRotations, getRotation } from "@/lib/db/rotations";
import type { RotationMode } from "@/lib/rotation";

export type CrewEvent = {
  kind: "bracket" | "rotation";
  id: string;
  href: string;
  name: string;
  format: TournamentFormat | RotationMode;
  live: boolean;
  createdAt: Date;
  /** Winner's name(s) once it's finished. */
  champion: string | null;
  players: number;
};

const first = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] || "—";

export async function getCrewEvents(groupId: string, opts: { limit?: number } = {}): Promise<CrewEvent[]> {
  const [brackets, rotations] = await Promise.all([getGroupTournaments(groupId), getGroupRotations(groupId)]);
  const all = [
    ...brackets.map((b) => ({ kind: "bracket" as const, id: b.id, createdAt: b.createdAt })),
    ...rotations.map((r) => ({ kind: "rotation" as const, id: r.id, createdAt: r.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, opts.limit ?? 30);

  const out = await Promise.all(
    all.map(async (e): Promise<CrewEvent | null> => {
      if (e.kind === "bracket") {
        const t = await getTournament(e.id);
        if (!t) return null;
        return {
          kind: "bracket",
          id: t.id,
          href: `/tournaments/${t.id}`,
          name: t.name,
          format: t.format,
          live: t.status !== "completed",
          createdAt: e.createdAt,
          champion: t.championEntrant?.names ?? null,
          players:
            new Set(
              [...t.winnersRounds, ...t.losersRounds, ...t.roundRobinRounds, ...(t.grandFinal ? [[t.grandFinal]] : [])]
                .flat()
                .flatMap((m) => [m.entrantA?.id, m.entrantB?.id])
                .filter(Boolean),
            ).size * 2,
        };
      }
      const r = await getRotation(e.id);
      if (!r) return null;
      const champ = r.status === "completed" ? r.standings.find((s) => s.games > 0) : undefined;
      return {
        kind: "rotation",
        id: r.id,
        href: `/americano/${r.id}`,
        name: r.name,
        format: r.mode,
        live: r.status !== "completed",
        createdAt: e.createdAt,
        champion: champ ? first(r.players.find((p) => p.id === champ.userId)?.name) : null,
        players: r.players.length,
      };
    }),
  );
  return out.filter((x): x is CrewEvent => !!x);
}
