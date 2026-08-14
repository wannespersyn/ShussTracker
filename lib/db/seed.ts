import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  users,
  groups,
  groupMembers,
  games,
  gameTeams,
  gameTeamPlayers,
  shots,
} from "@/lib/db/schema";

/** Dev-only dummy data. Run with: npx tsx --env-file=.env lib/db/seed.ts */

const FIELD_HITS = ["1", "2", "3", "mama", "miss"] as const;
type FieldHit = (typeof FIELD_HITS)[number];

function randomHit(): FieldHit {
  const weights: [FieldHit, number][] = [
    ["1", 30],
    ["2", 20],
    ["3", 10],
    ["mama", 10],
    ["miss", 30],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [hit, w] of weights) {
    if (r < w) return hit;
    r -= w;
  }
  return "miss";
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const me = await db
    .insert(users)
    .values({ name: "Wannes", email: "wannes.persyn@gmail.com" })
    .onConflictDoUpdate({ target: users.email, set: { name: "Wannes" } })
    .returning();
  const meId = me[0].id;

  const teammateNames = ["Bram", "Sanne", "Jonas", "Fien", "Robbe", "Elise"];
  const teammates = await Promise.all(
    teammateNames.map((name) =>
      db
        .insert(users)
        .values({ name, email: `${name.toLowerCase()}.dummy@example.com` })
        .onConflictDoUpdate({ target: users.email, set: { name } })
        .returning()
        .then((r) => r[0]),
    ),
  );

  const groupId = randomUUID();
  await db.insert(groups).values({
    id: groupId,
    name: "The Mama Hunters",
    inviteCode: "SHUSS1",
    createdBy: meId,
  });

  const memberIds = [meId, ...teammates.map((t) => t.id)];
  await db.insert(groupMembers).values(memberIds.map((userId) => ({ groupId, userId })));

  // Round-robin doubles: me + one teammate vs two other teammates, across several games.
  const gameCount = 12;
  for (let i = 0; i < gameCount; i++) {
    const shuffled = [...teammates].sort(() => Math.random() - 0.5);
    const partner = shuffled[0];
    const opponents = shuffled.slice(1, 3);

    const gameId = randomUUID();
    const myTeamWins = Math.random() < 0.6;

    await db.insert(games).values({
      id: gameId,
      groupId,
      createdBy: meId,
      playedAt: daysAgo(gameCount - i),
      matType: Math.random() < 0.5 ? "4" : "8",
    });

    const teamAId = randomUUID();
    const teamBId = randomUUID();
    await db.insert(gameTeams).values([
      { id: teamAId, gameId, teamLabel: "Team A", finalRank: myTeamWins ? 1 : 2 },
      { id: teamBId, gameId, teamLabel: "Team B", finalRank: myTeamWins ? 2 : 1 },
    ]);

    const teamAPlayers = [meId, partner.id];
    const teamBPlayers = opponents.map((o) => o.id);

    const gtpRows = [
      ...teamAPlayers.map((userId) => ({ id: randomUUID(), gameTeamId: teamAId, userId })),
      ...teamBPlayers.map((userId) => ({ id: randomUUID(), gameTeamId: teamBId, userId })),
    ];
    await db.insert(gameTeamPlayers).values(gtpRows);

    const shotRows = gtpRows.flatMap((gtp) => {
      const shotCount = 4 + Math.floor(Math.random() * 5);
      return Array.from({ length: shotCount }, () => ({
        gameTeamPlayerId: gtp.id,
        fieldHit: randomHit(),
      }));
    });
    await db.insert(shots).values(shotRows);
  }

  console.log(`Seeded crew "The Mama Hunters" (code SHUSS1) with ${memberIds.length} members and ${gameCount} games.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
