import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  date,
  primaryKey,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/* -----------------------------------------------------------------------
 * Auth.js tables (Drizzle adapter shape). Column names on the right match
 * what the brief's `User` entity asked for; the JS field names on the
 * left (`name`, `email`, `emailVerified`, `image`) are fixed by
 * @auth/drizzle-adapter and must not be renamed.
 * --------------------------------------------------------------------- */

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("display_name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // A guest is a normal `user` row (games/shots/stats all work unchanged)
  // added by a crew member for someone without an account yet — no email,
  // no Auth.js account/session row. `claimToken` is set only while a guest
  // is unclaimed; claiming reassigns every FK that points at the guest's
  // id onto the claimer's real account and deletes the guest row (see
  // lib/db/guests.ts), so the token only ever needs to resolve once.
  isGuest: boolean("is_guest").notNull().default(false),
  claimToken: text("claim_token").unique(),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* -----------------------------------------------------------------------
 * Game domain — from the brief's data model. Games/shots can exist with
 * a null group/event (casual logging is allowed, not required).
 *
 * There is no Postgres RLS here (that's a Supabase-auth pattern tied to
 * `auth.uid()` JWT claims flowing into the DB session, which Neon/Auth.js
 * doesn't do). Authorization is instead enforced in the data-access layer
 * — see lib/db/authz.ts — every query is scoped by the signed-in session
 * user id before it touches these tables.
 * --------------------------------------------------------------------- */

export const matTypeEnum = pgEnum("mat_type", ["2", "4", "8"]);
export const fieldHitEnum = pgEnum("field_hit", [
  "1",
  "2",
  "3",
  "mama",
  "miss",
]);

export const groups = pgTable("group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Off by default — most crews never actually pin down which of the 1/2/3
  // field zones a cap landed in mid-game, they just log the mama hits. A
  // crew can opt into full zone tracking here; stats/achievements that need
  // that granularity fall back to a collapsed hit/miss/mama view (see
  // lib/db/stats.ts, lib/db/achievements.ts) whenever the underlying games
  // don't actually have "2"/"3" shots recorded, regardless of this flag.
  trackShotZones: boolean("track_shot_zones").notNull().default(false),
});

export const groupMembers = pgTable(
  "group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

export const events = pgTable("event", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  date: date("date").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
});

export const games = pgTable("game", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  eventId: uuid("event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  playedAt: timestamp("played_at").notNull().defaultNow(),
  location: text("location"),
  matType: matTypeEnum("mat_type").notNull(),
});

export const gameTeams = pgTable("game_team", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  teamLabel: text("team_label").notNull(),
  finalRank: integer("final_rank"),
});

// Team size (1 player for a 2-player head-to-head mat, 2 for a 4/8-player
// mat) is enforced in the data-access layer (lib/db/authz.ts /
// game-creation logic), not a DB constraint — Postgres CHECK constraints
// can't count sibling rows without a trigger.
// Has its own `id` (rather than a composite PK) so Shot can carry a
// single game_team_player_id FK, per the brief's Shot shape.
export const gameTeamPlayers = pgTable(
  "game_team_player",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameTeamId: uuid("game_team_id")
      .notNull()
      .references(() => gameTeams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.gameTeamId, t.userId)],
);

export const shots = pgTable("shot", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameTeamPlayerId: uuid("game_team_player_id")
    .notNull()
    .references(() => gameTeamPlayers.id, { onDelete: "cascade" }),
  fieldHit: fieldHitEnum("field_hit").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

/* -----------------------------------------------------------------------
 * Crew activity — trash talk on a logged game. A fixed, small reaction set
 * (rather than free-form emoji) keeps the picker simple and the tally
 * meaningful; one row per (game, user, reaction) so a tap toggles it.
 * --------------------------------------------------------------------- */

export const reactionEnum = pgEnum("reaction", ["fire", "laugh", "beer", "skull"]);

export const gameComments = pgTable("game_comment", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const gameReactions = pgTable(
  "game_reaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reaction: reactionEnum("reaction").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.gameId, t.userId, t.reaction)],
);

/* -----------------------------------------------------------------------
 * Rivalries — a pinned "beef" between two sides within a crew. Each side is
 * 1 player (a solo rivalry, matching a 2-player mat) or 2 players (a duo
 * rivalry, matching a 4/8-player mat) — `player2Id` null means solo. The
 * running score itself isn't stored here; it's computed live from game
 * history (lib/db/rivalries.ts), same as every other stat in this app, by
 * finding games where one side's exact player set faced the other's.
 * --------------------------------------------------------------------- */

export const rivalries = pgTable("rivalry", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  aPlayer1Id: uuid("a_player1_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  aPlayer2Id: uuid("a_player2_id").references(() => users.id, { onDelete: "cascade" }),
  bPlayer1Id: uuid("b_player1_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bPlayer2Id: uuid("b_player2_id").references(() => users.id, { onDelete: "cascade" }),
});

/* -----------------------------------------------------------------------
 * Tournament domain — a bracket or schedule over a crew's members, seeded
 * as fixed duos ("entrants") at creation time. A played match's result is
 * a normal game/gameTeams/shots row (so tournament games count toward
 * every existing stat), just linked back onto the match.
 * --------------------------------------------------------------------- */

export const tournamentStatusEnum = pgEnum("tournament_status", ["setup", "active", "completed"]);
export const tournamentFormatEnum = pgEnum("tournament_format", ["single_elim", "double_elim", "round_robin"]);

export const tournaments = pgTable("tournament", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  format: tournamentFormatEnum("format").notNull().default("single_elim"),
  status: tournamentStatusEnum("status").notNull().default("setup"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A fixed duo for the life of the tournament — distinct from gameTeams,
// which exist per played game. Formed manually or via Chwazi at creation.
export const tournamentEntrants = pgTable("tournament_entrant", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  seed: integer("seed").notNull(),
  player1Id: uuid("player1_id")
    .notNull()
    .references(() => users.id),
  player2Id: uuid("player2_id")
    .notNull()
    .references(() => users.id),
});

export const tournamentBracketEnum = pgEnum("tournament_bracket", ["winners", "losers", "grand_final", "round_robin"]);
export const tournamentMatchSlotEnum = pgEnum("tournament_match_slot", ["a", "b"]);

// A bracket/schedule slot. `bracket` distinguishes a double-elim match's
// winners-bracket, losers-bracket, or grand-final leg (round-robin has one
// flat "round_robin" bracket); `round`/`slot` place it within that
// bracket for display and are unique per (tournamentId, bracket, round,
// slot). Propagation is via explicit `winnerNext*`/`loserNext*` pointers
// (set at creation, followed at result-recording time) rather than
// round/slot arithmetic — single-elim's simple round-doubling and
// double-elim's alternating consolidation/drop-in losers-bracket rounds
// don't share one formula, and pointers work for both plus round-robin's
// "no propagation at all" uniformly. Every match beyond a bracket's first
// round starts with null entrant slots; a single-elim bye (odd entrant
// count) resolves immediately with `winnerEntrantId` set and no `gameId`
// — double-elim instead requires an exact power-of-two entrant count so
// its losers bracket never has to reason about byes.
export const tournamentMatches = pgTable(
  "tournament_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    bracket: tournamentBracketEnum("bracket").notNull().default("winners"),
    round: integer("round").notNull(),
    slot: integer("slot").notNull(),
    entrantAId: uuid("entrant_a_id").references(() => tournamentEntrants.id, { onDelete: "set null" }),
    entrantBId: uuid("entrant_b_id").references(() => tournamentEntrants.id, { onDelete: "set null" }),
    winnerEntrantId: uuid("winner_entrant_id").references(() => tournamentEntrants.id, { onDelete: "set null" }),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "set null" }),
    // Where this match's winner/loser flows next — null when nobody
    // advances further on that side (a decisive match, or round-robin's
    // no-propagation matches).
    winnerNextMatchId: uuid("winner_next_match_id").references((): AnyPgColumn => tournamentMatches.id, {
      onDelete: "set null",
    }),
    winnerNextSlot: tournamentMatchSlotEnum("winner_next_slot"),
    loserNextMatchId: uuid("loser_next_match_id").references((): AnyPgColumn => tournamentMatches.id, {
      onDelete: "set null",
    }),
    loserNextSlot: tournamentMatchSlotEnum("loser_next_slot"),
  },
  (t) => [unique().on(t.tournamentId, t.bracket, t.round, t.slot)],
);

/* -----------------------------------------------------------------------
 * Relations (for the Drizzle relational query API)
 * --------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  groupMemberships: many(groupMembers),
  gamesCreated: many(games),
}));

export const groupsRelations = relations(groups, ({ many, one }) => ({
  members: many(groupMembers),
  events: many(events),
  games: many(games),
  rivalries: many(rivalries),
  createdByUser: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
}));

export const rivalriesRelations = relations(rivalries, ({ one }) => ({
  group: one(groups, { fields: [rivalries.groupId], references: [groups.id] }),
  aPlayer1: one(users, { fields: [rivalries.aPlayer1Id], references: [users.id], relationName: "rivalryAPlayer1" }),
  aPlayer2: one(users, { fields: [rivalries.aPlayer2Id], references: [users.id], relationName: "rivalryAPlayer2" }),
  bPlayer1: one(users, { fields: [rivalries.bPlayer1Id], references: [users.id], relationName: "rivalryBPlayer1" }),
  bPlayer2: one(users, { fields: [rivalries.bPlayer2Id], references: [users.id], relationName: "rivalryBPlayer2" }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  group: one(groups, {
    fields: [events.groupId],
    references: [groups.id],
  }),
  games: many(games),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  group: one(groups, {
    fields: [games.groupId],
    references: [groups.id],
  }),
  event: one(events, {
    fields: [games.eventId],
    references: [events.id],
  }),
  teams: many(gameTeams),
  comments: many(gameComments),
  reactions: many(gameReactions),
}));

export const gameCommentsRelations = relations(gameComments, ({ one }) => ({
  game: one(games, { fields: [gameComments.gameId], references: [games.id] }),
  user: one(users, { fields: [gameComments.userId], references: [users.id] }),
}));

export const gameReactionsRelations = relations(gameReactions, ({ one }) => ({
  game: one(games, { fields: [gameReactions.gameId], references: [games.id] }),
  user: one(users, { fields: [gameReactions.userId], references: [users.id] }),
}));

export const gameTeamsRelations = relations(gameTeams, ({ one, many }) => ({
  game: one(games, {
    fields: [gameTeams.gameId],
    references: [games.id],
  }),
  players: many(gameTeamPlayers),
}));

export const gameTeamPlayersRelations = relations(
  gameTeamPlayers,
  ({ one, many }) => ({
    gameTeam: one(gameTeams, {
      fields: [gameTeamPlayers.gameTeamId],
      references: [gameTeams.id],
    }),
    user: one(users, {
      fields: [gameTeamPlayers.userId],
      references: [users.id],
    }),
    shots: many(shots),
  }),
);

export const shotsRelations = relations(shots, ({ one }) => ({
  gameTeamPlayer: one(gameTeamPlayers, {
    fields: [shots.gameTeamPlayerId],
    references: [gameTeamPlayers.id],
  }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  group: one(groups, { fields: [tournaments.groupId], references: [groups.id] }),
  event: one(events, { fields: [tournaments.eventId], references: [events.id] }),
  entrants: many(tournamentEntrants),
  matches: many(tournamentMatches),
}));

export const tournamentEntrantsRelations = relations(tournamentEntrants, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentEntrants.tournamentId],
    references: [tournaments.id],
  }),
  player1: one(users, {
    fields: [tournamentEntrants.player1Id],
    references: [users.id],
    relationName: "entrantPlayer1",
  }),
  player2: one(users, {
    fields: [tournamentEntrants.player2Id],
    references: [users.id],
    relationName: "entrantPlayer2",
  }),
}));

export const tournamentMatchesRelations = relations(tournamentMatches, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentMatches.tournamentId],
    references: [tournaments.id],
  }),
  entrantA: one(tournamentEntrants, {
    fields: [tournamentMatches.entrantAId],
    references: [tournamentEntrants.id],
    relationName: "matchEntrantA",
  }),
  entrantB: one(tournamentEntrants, {
    fields: [tournamentMatches.entrantBId],
    references: [tournamentEntrants.id],
    relationName: "matchEntrantB",
  }),
  winnerEntrant: one(tournamentEntrants, {
    fields: [tournamentMatches.winnerEntrantId],
    references: [tournamentEntrants.id],
    relationName: "matchWinnerEntrant",
  }),
  game: one(games, { fields: [tournamentMatches.gameId], references: [games.id] }),
}));
