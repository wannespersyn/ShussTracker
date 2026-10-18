import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, users } from "@/lib/db/schema";
import { sendPush } from "@/lib/push";
import { firstName } from "@/lib/insights";

/* What triggers a push. Called from server actions inside `after()`, so
 * the user who did the thing never waits on it. */

async function gamePeople(gameId: string) {
  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
    columns: { id: true, createdBy: true },
    with: { teams: { columns: { finalRank: true }, with: { players: { columns: { userId: true }, with: { user: { columns: { name: true, isGuest: true } } } } } } },
  });
  return game;
}

async function nameOf(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { name: true } });
  return firstName(u?.name ?? "Someone");
}

const playersOf = (game: NonNullable<Awaited<ReturnType<typeof gamePeople>>>) =>
  game.teams.flatMap((t) => t.players.filter((p) => !p.user.isGuest).map((p) => p.userId));

export async function notifyComment(gameId: string, authorId: string, text: string) {
  const game = await gamePeople(gameId);
  if (!game) return;
  const to = [...playersOf(game), game.createdBy].filter((id) => id !== authorId);
  const who = await nameOf(authorId);
  await sendPush(to, { title: `${who} on your game`, body: text.slice(0, 140), url: `/game/${gameId}`, tag: `game-${gameId}-comments` });
}

const REACTION_WORD: Record<string, string> = { fire: "fire", laugh: "laughing", beer: "cheers", skull: "dead" };

export async function notifyReaction(gameId: string, reactorId: string, reaction: string) {
  const game = await gamePeople(gameId);
  if (!game) return;
  const to = playersOf(game).filter((id) => id !== reactorId);
  const who = await nameOf(reactorId);
  await sendPush(to, { title: `${who} reacted to your game`, body: `“${REACTION_WORD[reaction] ?? reaction}”`, url: `/game/${gameId}`, tag: `game-${gameId}-reactions` });
}

export async function notifyGameLogged(gameId: string, loggerId: string) {
  const game = await gamePeople(gameId);
  if (!game) return;
  const who = await nameOf(loggerId);
  const best = Math.min(...game.teams.map((t) => t.finalRank ?? 99));
  await Promise.all(
    game.teams.flatMap((t) =>
      t.players
        .filter((p) => !p.user.isGuest && p.userId !== loggerId)
        .map((p) => {
          const opponents = game.teams
            .filter((x) => x !== t)
            .flatMap((x) => x.players.map((q) => firstName(q.user.name ?? "")))
            .join(" & ");
          return sendPush([p.userId], {
            title: t.finalRank === best ? "Win logged" : "Loss logged",
            body: `${who} logged your game vs ${opponents}. Tap to roast or react.`,
            url: `/game/${gameId}`,
          });
        }),
    ),
  );
}
