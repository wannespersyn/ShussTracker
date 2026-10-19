/**
 * Team helpers
 *
 * Mirrors the website's lib/teams.ts and shortNamesFor: random duo pairing,
 * solo "teams" for 1v1, and short display names that stay unique within a
 * group of players ("Jan", "Jan D." / "Jan V.").
 *
 * Exports: Team, shuffleIntoDuos, pairIntoDuos, balanceIntoDuos, pairIntoSolos,
 *          shortNamesFor
 */
export type Player = { id: string; name: string };
export type Team = { id: string; label: string; players: Player[] };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Consecutive pairs of an already-ordered list (0+1, 2+3, …). */
export function pairIntoDuos(order: Player[]): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i < order.length; i += 2) teams.push({ id: `team-${i / 2}`, label: `Team ${i / 2 + 1}`, players: [order[i], order[i + 1]] });
  return teams;
}

export function shuffleIntoDuos(players: Player[]): Team[] {
  return pairIntoDuos(shuffle(players));
}

/** Chwazi's "balance by Elo": strongest with weakest, next with next, so no
 * duo is stacked; which pair lands in which slot is still random. */
export function balanceIntoDuos(players: Player[], ratings: Record<string, number>): Team[] {
  const sorted = [...players].sort((a, b) => (ratings[b.id] ?? 1000) - (ratings[a.id] ?? 1000));
  const pairs: Player[] = [];
  for (let lo = 0, hi = sorted.length - 1; lo < hi; lo++, hi--) pairs.push(sorted[lo], sorted[hi]);
  const duos = pairIntoDuos(pairs);
  return shuffle(duos).map((d, i) => ({ ...d, id: `team-${i}`, label: `Team ${i + 1}` }));
}

export function pairIntoSolos(players: Player[]): Team[] {
  return players.map((p, i) => ({ id: `team-${i}`, label: p.name, players: [p] }));
}

export function shortNamesFor(people: Player[]): Record<string, string> {
  const parsed = people.map((p) => {
    const [rawFirst = p.name, ...rest] = p.name.trim().split(/\s+/);
    if (rawFirst.length <= 3 && rest.length > 0) return { id: p.id, first: p.name.trim(), last: "" };
    return { id: p.id, first: rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1), last: rest.join(" ") };
  });
  const byFirst = new Map<string, typeof parsed>();
  for (const e of parsed) byFirst.set(e.first, [...(byFirst.get(e.first) ?? []), e]);
  const out: Record<string, string> = {};
  for (const group of byFirst.values()) {
    if (group.length === 1) {
      out[group[0].id] = group[0].first;
      continue;
    }
    for (const e of group) {
      const initial = e.last ? `${e.last[0].toUpperCase()}.` : "";
      const twins = group.filter((x) => (x.last[0] ?? "") === (e.last[0] ?? "")).length > 1;
      out[e.id] = twins && e.last ? `${e.first} ${e.last}` : `${e.first}${initial ? ` ${initial}` : ""}`;
    }
  }
  return out;
}
