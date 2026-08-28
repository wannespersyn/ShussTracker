import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameComments, gameReactions, games } from "@/lib/db/schema";

export type Reaction = "fire" | "laugh" | "beer" | "skull";
export const REACTIONS: Reaction[] = ["fire", "laugh", "beer", "skull"];
export const REACTION_GLYPH: Record<Reaction, string> = { fire: "🔥", laugh: "😂", beer: "🍺", skull: "💀" };

export async function addComment(gameId: string, userId: string, text: string) {
  await db.insert(gameComments).values({ id: randomUUID(), gameId, userId, text });
}

export async function deleteComment(commentId: string) {
  await db.delete(gameComments).where(eq(gameComments.id, commentId));
}

export async function getComment(commentId: string) {
  return db.query.gameComments.findFirst({ where: eq(gameComments.id, commentId) });
}

/** A tap toggles: inserting the reaction if absent, removing it if it's
 * already there — one row per (game, user, reaction), enforced by the
 * schema's unique constraint. */
export async function toggleReaction(gameId: string, userId: string, reaction: Reaction) {
  const existing = await db.query.gameReactions.findFirst({
    where: and(
      eq(gameReactions.gameId, gameId),
      eq(gameReactions.userId, userId),
      eq(gameReactions.reaction, reaction),
    ),
  });
  if (existing) {
    await db.delete(gameReactions).where(eq(gameReactions.id, existing.id));
  } else {
    await db.insert(gameReactions).values({ id: randomUUID(), gameId, userId, reaction });
  }
}

export type GameComment = { id: string; userId: string; userName: string; text: string; createdAt: Date };
export type ReactionTally = { reaction: Reaction; count: number; reactedByMe: boolean };

function tallyReactions(rows: { userId: string; reaction: Reaction }[], viewerId: string): ReactionTally[] {
  const byReaction = new Map<Reaction, { count: number; reactedByMe: boolean }>();
  for (const r of rows) {
    const entry = byReaction.get(r.reaction) ?? { count: 0, reactedByMe: false };
    entry.count++;
    if (r.userId === viewerId) entry.reactedByMe = true;
    byReaction.set(r.reaction, entry);
  }
  return REACTIONS.map((r) => ({
    reaction: r,
    count: byReaction.get(r)?.count ?? 0,
    reactedByMe: byReaction.get(r)?.reactedByMe ?? false,
  }));
}

/** Everything the game recap page's "comments & reactions" section needs
 * for one game. */
export async function getGameActivity(
  gameId: string,
  viewerId: string,
): Promise<{ comments: GameComment[]; reactions: ReactionTally[] }> {
  const [comments, reactions] = await Promise.all([
    db.query.gameComments.findMany({
      where: eq(gameComments.gameId, gameId),
      with: { user: true },
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    }),
    db.query.gameReactions.findMany({ where: eq(gameReactions.gameId, gameId) }),
  ]);

  return {
    comments: comments.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name ?? "Player",
      text: c.text,
      createdAt: c.createdAt,
    })),
    reactions: tallyReactions(reactions, viewerId),
  };
}

export type FeedGame = {
  id: string;
  playedAt: Date;
  matType: "2" | "4" | "8";
  teams: { label: string; finalRank: number | null; playerNames: string[] }[];
  commentCount: number;
  reactions: ReactionTally[];
};

/** Recent games in a crew, newest first, with comment/reaction summaries —
 * the crew activity feed: what happened lately, not just who's ahead. */
export async function getCrewActivityFeed(groupId: string, viewerId: string, limit = 25): Promise<FeedGame[]> {
  const groupGames = await db.query.games.findMany({
    where: eq(games.groupId, groupId),
    with: {
      teams: { with: { players: { with: { user: true } } } },
      comments: true,
      reactions: true,
    },
  });

  return groupGames
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .slice(0, limit)
    .map((g) => ({
      id: g.id,
      playedAt: g.playedAt,
      matType: g.matType,
      teams: [...g.teams]
        .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))
        .map((t) => ({
          label: t.teamLabel,
          finalRank: t.finalRank,
          playerNames: t.players.map((p) => p.user.name ?? "Player"),
        })),
      commentCount: g.comments.length,
      reactions: tallyReactions(g.reactions, viewerId),
    }));
}
