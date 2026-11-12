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
  jsonb,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
  // Shussapp Beta is opt-in per person (Settings › Beta). `betaDisabled`
  // holds the keys of beta features the user switched off individually
  // while staying in the beta; see lib/beta.ts for the feature registry.
  betaOptIn: boolean("beta_opt_in").notNull().default(false),
  betaJoinedAt: timestamp("beta_joined_at"),
  betaDisabled: text("beta_disabled").array().notNull().default(sql`'{}'::text[]`),
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
 * a null group (casual logging is allowed, not required).
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
  // Landed in a mama but shot out of it later that round: not counted as a mama.
  "mama_out",
]);

export const crewPlanEnum = pgEnum("crew_plan", ["free", "founding", "pro"]);

export const groups = pgTable("group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Legacy: the crew default for the old per-zone shot counter. No longer read
  // or set (shot tracking is now the beta mat logger); kept so old rows stay valid.
  trackShotZones: boolean("track_shot_zones").notNull().default(false),
  // Crew Pro. "founding" = crews that existed before v2 launched; they get
  // Pro free until `proUntil`. No paywall is enforced yet (see lib/plan.ts).
  plan: crewPlanEnum("plan").notNull().default("free"),
  proUntil: timestamp("pro_until"),
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

export const games = pgTable("game", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  playedAt: timestamp("played_at").notNull().defaultNow(),
  location: text("location"),
  matType: matTypeEnum("mat_type").notNull(),
  // Photo of the mat (Vercel Blob URL), shown on the game page, feed and recap.
  photoUrl: text("photo_url"),
  // Mat logger (beta): corner A1 started in ("TL" | "TR" | "BL" | "BR", as seen
  // with the mat upright on a phone) and how the game ended ("pints_empty").
  // Null for games logged without the mat.
  matA1Corner: text("mat_a1_corner"),
  endedBy: text("ended_by"),
});

export const gameTeams = pgTable("game_team", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  teamLabel: text("team_label").notNull(),
  finalRank: integer("final_rank"),
  // Kruipen: this (losing) team didn't get to drink anything before the
  // winners emptied their pints. Set automatically by the mat logger, or
  // ticked by hand when logging; stats count it for every player in the team.
  kruip: boolean("kruip").notNull().default(false),
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
  // Defending: the defender's flick moved an opponent's cap. Whatever that
  // flick changes is the defender's shot. `fieldHit` is where the cap ended
  // up ("miss" = stopped, nothing scored). `ownGoal` = it ended up in a zone
  // that scores for the other team, so those points go to them.
  defense: boolean("defense").notNull().default(false),
  ownGoal: boolean("own_goal").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

/* -----------------------------------------------------------------------
 * Mat logger (beta) — every cap movement of a game, so any stat can be
 * recomputed later. game → rounds → throws → cap moves. Spots are stored as
 * they were judged when logging ("L1".."R3" zones, "ML"/"MR" mamas,
 * "box:a1" shooting boxes, "waiting", "off", "none", "miss"), next to the raw
 * mat coordinates (landscape mat space, 824×265), so a later change to the
 * mat geometry never rewrites history.
 * --------------------------------------------------------------------- */

export const gameRounds = pgTable("game_round", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  // False for the round that was still going when a team emptied its pints.
  complete: boolean("complete").notNull().default(true),
  // A team played its (one per game) joker on this round: nobody drinks, mama included.
  // The per-team sips/mama rows keep what *would* have been drunk.
  jokerTeamId: uuid("joker_team_id").references(() => gameTeams.id, { onDelete: "set null" }),
  // Third round in a row with nothing to drink: everyone ad fundum.
  allDrink: boolean("all_drink").notNull().default(false),
});

/** Drinking result of a round per team: sips from caps lying in that team's
 * zones, or `mama` (empty the pints, nobody sips). */
export const gameRoundTeams = pgTable("game_round_team", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id")
    .notNull()
    .references(() => gameRounds.id, { onDelete: "cascade" }),
  gameTeamId: uuid("game_team_id")
    .notNull()
    .references(() => gameTeams.id, { onDelete: "cascade" }),
  sips: integer("sips").notNull().default(0),
  mama: boolean("mama").notNull().default(false),
});

/** One turn. `kind`: "normal", "bonus" (extra throw, last of the round, with
 * the cap lying in their shooting box) or "skipped" (`skipReason`
 * "cap_knocked" = their waiting cap was shot away, "box_empty" = the cap in
 * their box was gone by the time of the extra throw). */
export const gameThrows = pgTable("game_throw", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id")
    .notNull()
    .references(() => gameRounds.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  gameTeamPlayerId: uuid("game_team_player_id")
    .notNull()
    .references(() => gameTeamPlayers.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(),
  kind: text("kind").notNull(),
  skipReason: text("skip_reason"),
  // Cap number within the game (caps are numbered as they enter play).
  capNo: integer("cap_no"),
});

/** Every cap that moved during a throw: the thrown cap itself
 * (`isThrownCap`) and each cap it knocked. `toCountsFor` = the team that
 * zone/mama counts for, null when it counts for nobody. */
export const capMoves = pgTable("cap_move", {
  id: uuid("id").primaryKey().defaultRandom(),
  throwId: uuid("throw_id")
    .notNull()
    .references(() => gameThrows.id, { onDelete: "cascade" }),
  capNo: integer("cap_no").notNull(),
  capOwnerId: uuid("cap_owner_id")
    .notNull()
    .references(() => gameTeamPlayers.id, { onDelete: "cascade" }),
  isThrownCap: boolean("is_thrown_cap").notNull(),
  fromX: integer("from_x"),
  fromY: integer("from_y"),
  fromSpot: text("from_spot").notNull(),
  toX: integer("to_x"),
  toY: integer("to_y"),
  toSpot: text("to_spot").notNull(),
  toCountsFor: uuid("to_counts_for").references(() => gameTeams.id, { onDelete: "set null" }),
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
 * Rotation tournaments (Americano / Mexicano) — "everybody plays with
 * everybody": individual players, not fixed duos. Each round splits the
 * active players into 2v2 games (the rest sit out); a played game is a
 * normal `game` row linked back here, so it counts for every stat.
 * --------------------------------------------------------------------- */

export const rotationModeEnum = pgEnum("rotation_mode", ["americano", "mexicano"]);

export const rotations = pgTable("rotation", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mode: rotationModeEnum("mode").notNull(),
  // Games that can run at the same time tonight (one per mat).
  mats: integer("mats").notNull().default(1),
  // Planned rounds (Americano: all generated up front; Mexicano: the cap).
  rounds: integer("rounds").notNull(),
  // Standings order after win %: comma list of "wins" | "mama" | "elo" | "pct".
  tiebreaks: text("tiebreaks").notNull().default("pct,wins,mama,elo"),
  status: tournamentStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rotationPlayers = pgTable(
  "rotation_player",
  {
    rotationId: uuid("rotation_id")
      .notNull()
      .references(() => rotations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // False once they stopped: no new games, their played games still count.
    active: boolean("active").notNull().default(true),
    // First round they could play (later for someone who joined mid-way).
    joinedRound: integer("joined_round").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.rotationId, t.userId] })],
);

/** One planned 2v2 in a round (`idx` = order within the round). Players who
 * are in the rotation but not in any game of a round sat that round out. */
export const rotationGames = pgTable(
  "rotation_game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rotationId: uuid("rotation_id")
      .notNull()
      .references(() => rotations.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    idx: integer("idx").notNull(),
    a1: uuid("a1").notNull().references(() => users.id),
    a2: uuid("a2").notNull().references(() => users.id),
    b1: uuid("b1").notNull().references(() => users.id),
    b2: uuid("b2").notNull().references(() => users.id),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "set null" }),
  },
  (t) => [unique().on(t.rotationId, t.round, t.idx)],
);

/** A player's own stats page: screens of blocks (see lib/stats-layout.ts),
 * validated on every save. No row = the default layout. */
export const statsLayouts = pgTable("stats_layout", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  layout: jsonb("layout").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* -----------------------------------------------------------------------
 * Feedback & feature requests — the in-app "help build Shussapp" inbox.
 * Ideas are public within the app and can be upvoted; bugs/other are only
 * visible to admins.
 * --------------------------------------------------------------------- */

/** Web Push subscriptions — one per device/browser that turned on
 * notifications. Dead endpoints are pruned when a send returns 404/410. */
export const pushSubscriptions = pgTable("push_subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  /** UI language of the device that subscribed — pushes are written in it. */
  locale: text("locale").notNull().default("en"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const feedbackTypeEnum = pgEnum("feedback_type", ["bug", "idea", "other"]);
export const feedbackStatusEnum = pgEnum("feedback_status", ["new", "under_review", "planned", "in_progress", "done", "declined"]);

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  type: feedbackTypeEnum("type").notNull(),
  text: text("text").notNull(),
  status: feedbackStatusEnum("status").notNull().default("new"),
  // Set when the feedback is about a beta feature (key from lib/beta.ts);
  // `rating` is the 1–4 score from the beta feedback sheet, or 1/4 for a
  // quick thumbs down/up.
  feature: text("feature"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const feedbackVotes = pgTable(
  "feedback_vote",
  {
    feedbackId: uuid("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.feedbackId, t.userId] })],
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
  games: many(games),
  createdByUser: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
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

export const gamesRelations = relations(games, ({ one, many }) => ({
  group: one(groups, {
    fields: [games.groupId],
    references: [groups.id],
  }),
  teams: many(gameTeams),
  comments: many(gameComments),
  reactions: many(gameReactions),
  rounds: many(gameRounds),
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

export const gameRoundsRelations = relations(gameRounds, ({ one, many }) => ({
  game: one(games, { fields: [gameRounds.gameId], references: [games.id] }),
  teams: many(gameRoundTeams),
  throws: many(gameThrows),
}));

export const gameRoundTeamsRelations = relations(gameRoundTeams, ({ one }) => ({
  round: one(gameRounds, { fields: [gameRoundTeams.roundId], references: [gameRounds.id] }),
  gameTeam: one(gameTeams, { fields: [gameRoundTeams.gameTeamId], references: [gameTeams.id] }),
}));

export const gameThrowsRelations = relations(gameThrows, ({ one, many }) => ({
  round: one(gameRounds, { fields: [gameThrows.roundId], references: [gameRounds.id] }),
  thrower: one(gameTeamPlayers, { fields: [gameThrows.gameTeamPlayerId], references: [gameTeamPlayers.id] }),
  moves: many(capMoves),
}));

export const capMovesRelations = relations(capMoves, ({ one }) => ({
  throw: one(gameThrows, { fields: [capMoves.throwId], references: [gameThrows.id] }),
}));

export const shotsRelations = relations(shots, ({ one }) => ({
  gameTeamPlayer: one(gameTeamPlayers, {
    fields: [shots.gameTeamPlayerId],
    references: [gameTeamPlayers.id],
  }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  group: one(groups, { fields: [tournaments.groupId], references: [groups.id] }),
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

export const feedbackRelations = relations(feedback, ({ one, many }) => ({
  user: one(users, { fields: [feedback.userId], references: [users.id] }),
  group: one(groups, { fields: [feedback.groupId], references: [groups.id] }),
  votes: many(feedbackVotes),
}));

export const feedbackVotesRelations = relations(feedbackVotes, ({ one }) => ({
  feedback: one(feedback, { fields: [feedbackVotes.feedbackId], references: [feedback.id] }),
  user: one(users, { fields: [feedbackVotes.userId], references: [users.id] }),
}));

/* -----------------------------------------------------------------------
 * Camera (beta): a phone fixed above the mat streams its throws to the crew,
 * so others can follow and correct them from their own phone.
 * --------------------------------------------------------------------- */

export const cameraSessions = pgTable("camera_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  // The player whose phone is the camera.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Live until stopped; "live" also needs a recent heartbeat (updatedAt).
  live: boolean("live").notNull().default(true),
  // "calibrating" (waiting for corners on the empty-mat snapshot) → "watching".
  phase: text("phase").notNull().default("calibrating"),
  // Empty-mat snapshot (JPEG data URL) so anyone in the crew can set the
  // corners from their own phone or laptop; the version bumps per snapshot.
  snapshot: text("snapshot"),
  snapW: integer("snap_w"),
  snapH: integer("snap_h"),
  snapVersion: integer("snap_version").notNull().default(0),
  // Someone asked the camera for a new snapshot (counter).
  snapRequest: integer("snap_request").notNull().default(0),
  // Field corners on the snapshot (photo pixels, mat order).
  corners: jsonb("corners").$type<{ x: number; y: number }[]>(),
  // "test" until a mat logger links it to a game; only "game" data is used
  // for training.
  kind: text("kind").notNull().default("test"),
  // The player logging the game in the mat logger (null = camera on its own).
  loggerId: uuid("logger_id").references(() => users.id, { onDelete: "set null" }),
  // Linked to a logger, the camera only judges throws while armed (a throw is
  // expected); a bump of armVersion = start from the mat as it is now (after
  // clearing it for a new round).
  armed: boolean("armed").notNull().default(false),
  armVersion: integer("arm_version").notNull().default(0),
  // The camera's owner agreed to keep top-down pictures of the mat for
  // training (Vercel Blob); the empty mat as the reference picture.
  shareImages: boolean("share_images").notNull().default(false),
  emptyUrl: text("empty_url"),
  // "New game" from any phone: this session ended and the camera carries on
  // in this one (same calibration); the camera and viewers follow it.
  nextId: uuid("next_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cameraThrows = pgTable(
  "camera_throw",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => cameraSessions.id, { onDelete: "cascade" }),
    n: integer("n").notNull(),
    // Caps that landed or moved there in this throw (mat units, 824 × 265):
    // what the camera found, and the final list (corrected or not). One
    // throw can move several caps (the thrown one knocks another).
    found: jsonb("found").$type<{ x: number; y: number }[]>().notNull().default([]),
    spots: jsonb("spots").$type<{ x: number; y: number }[]>().notNull().default([]),
    // Where caps were knocked away from.
    gone: jsonb("gone").$type<{ x: number; y: number }[]>().notNull().default([]),
    correctedBy: uuid("corrected_by").references(() => users.id, { onDelete: "set null" }),
    // Someone looked at the throw and said it's right (✓), so it's reviewed.
    checkedBy: uuid("checked_by").references(() => users.id, { onDelete: "set null" }),
    // Full-size top-down picture after the throw (824 × 265 JPEG in Blob,
    // only when shared) and the detector that judged it.
    imageUrl: text("image_url"),
    detector: text("detector"),
    // Training label: every cap on the mat after the throw (field units,
    // with owner slot), as confirmed in the mat logger, and how sure it is:
    // "corrected" (moved by hand), "confirmed" (tapped done), "auto".
    label: jsonb("label").$type<{ x: number; y: number; owner: string; no: number }[]>(),
    labelHow: text("label_how"),
    // Every cap on the field after the throw (mat units, lib/camera-field.ts),
    // the field before it, and whether a person vouched for the whole field:
    // "checked" (✓) or "corrected"; null = as the camera judged it. Null
    // field: a throw from before the camera kept the whole field.
    field: jsonb("field").$type<{ x: number; y: number }[]>(),
    fieldBefore: jsonb("field_before").$type<{ x: number; y: number }[]>(),
    fieldHow: text("field_how"),
    // Small top-down JPEG (data URL) of the mat after the throw.
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("camera_throw_session_n").on(t.sessionId, t.n)],
);

// The game a mat logger is playing with a linked camera: the logger's state
// (lib/mat.ts MatState, player names, which camera throw became which mat
// throw), so the camera phone can show what the game made of every throw.
export const cameraGames = pgTable("camera_game", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => cameraSessions.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Per-zone nudges on top of the corners (lib/camera.ts ZoneFix, mat units),
// set on the camera itself or from another phone/laptop in the crew; the
// version bumps on every change so the camera picks it up.
export const cameraZoneFixes = pgTable("camera_zone_fix", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => cameraSessions.id, { onDelete: "cascade" }),
  fix: jsonb("fix").$type<Record<string, { dx: number; dy: number; s?: number }>>().notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
