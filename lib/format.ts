export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

type NameEntry = { id: string; first: string; last: string };

function groupBy<T>(entries: T[], keyOf: (e: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}

/** Labels one initial-collision group: falls back to the full last name only
 * if more than one entry still shares that initial. */
function labelCollidingGroup(sub: NameEntry[], result: Record<string, string>) {
  const stillColliding = sub.length > 1 && sub[0].last;
  for (const entry of sub) {
    result[entry.id] = !entry.last
      ? entry.first
      : stillColliding
        ? `${entry.first} ${entry.last}`
        : `${entry.first} ${entry.last[0].toUpperCase()}.`;
  }
}

/** Short display names for a roster, escalating only for players who
 * actually collide: bare first name, then first name + last initial, then
 * first name + full last name if the initial still ties. */
export function shortNamesFor(people: { id: string; name: string }[]): Record<string, string> {
  const parsed: NameEntry[] = people.map((p) => {
    const [first, ...rest] = p.name.trim().split(/\s+/);
    return { id: p.id, first, last: rest.join(" ") };
  });

  const result: Record<string, string> = {};
  for (const group of groupBy(parsed, (e) => e.first).values()) {
    if (group.length === 1) {
      result[group[0].id] = group[0].first;
      continue;
    }
    for (const sub of groupBy(group, (e) => (e.last ? e.last[0].toUpperCase() : "")).values()) {
      labelCollidingGroup(sub, result);
    }
  }
  return result;
}
