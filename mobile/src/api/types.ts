/**
 * API types
 *
 * Shapes of the /api/v1 responses the app uses (see docs/api-v1.md in the
 * repo root). Dates arrive as ISO strings.
 */
export type Me = {
  user: { id: string; name: string | null; email: string | null; image: string | null; isAdmin: boolean };
  crews: CrewSummary[];
};

export type CrewSummary = {
  id: string;
  name: string;
  members: number;
  games: number;
  lastPlayedAt: string | null;
  createdBy: string;
  isOwner: boolean;
};

export type SignInResponse = Me & { token: string; expiresAt: string; created: boolean };

export type Streak = { kind: "W" | "L"; n: number };

export type PlayerInsight = {
  userId: string;
  name: string;
  isGuest: boolean;
  elo: number;
  rank: number;
  move: number;
  eloWeek: number;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  mama: number;
  form: ("W" | "L")[];
  streak: Streak | null;
  bestWinStreak: number;
  eloHistory: { date: string; elo: number }[];
};

export type DuoInsight = {
  key: string;
  a: { id: string; name: string };
  b: { id: string; name: string };
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  duoElo: number;
  bestWinStreak: number;
};

export type SessionInsight = {
  /** YYYY-MM-DD of the night (games before 06:00 count for the evening before). */
  night: string;
  games: number;
  players: number;
  mvp: { userId: string; name: string; wins: number; eloDelta: number } | null;
  lines: { userId: string; name: string; games: number; wins: number; mama: number }[];
};

export type CrewDetail = {
  crew: { id: string; name: string; createdBy: string; isOwner: boolean; plan: string; isPro: boolean; trackShotZones: boolean; inviteCode?: string };
  insights: {
    players: PlayerInsight[];
    duos: DuoInsight[];
    sessions: SessionInsight[];
    totalGames: number;
    firstGameAt: string | null;
  };
  guests: { id: string; name: string; claimToken: string | null }[];
  tournaments: { id: string; name: string; status: string }[];
};

export type Reaction = "fire" | "laugh" | "beer" | "skull";
export type ReactionTally = { reaction: Reaction; count: number; reactedByMe: boolean };
export type GameComment = { id: string; userId: string; userName: string; text: string; createdAt: string };

export type GameDetail = {
  game: {
    id: string;
    playedAt: string;
    matType: "2" | "4" | "8";
    createdBy: string;
    crew: { id: string; name: string } | null;
    photoPath: string | null;
    tournamentId: string | null;
    canDelete: boolean;
    teams: {
      label: string;
      finalRank: number | null;
      players: {
        id: string;
        name: string | null;
        isGuest: boolean;
        eloDelta: number | null;
        shots: Record<"1" | "2" | "3" | "mama" | "miss", number>;
      }[];
    }[];
  };
  comments: GameComment[];
  reactions: ReactionTally[];
};

export type FeedGame = {
  id: string;
  playedAt: string;
  matType: "2" | "4" | "8";
  teams: { label: string; finalRank: number | null; playerNames: string[] }[];
  commentCount: number;
  reactions: ReactionTally[];
  mama: number;
  photoPath: string | null;
};

export type Achievement = {
  id: string;
  cat: "streak" | "games" | "shots" | "social";
  name: string;
  desc: string;
  icon: "flame" | "bolt" | "crown" | "star" | "target";
  have: number;
  need: number;
  got: boolean;
};

export type PlayerProfile = {
  player: { id: string; name: string | null; image: string | null; isGuest: boolean; isSelf: boolean };
  crew: { id: string; name: string; rankedPlayers: number } | null;
  stats: PlayerInsight | null;
  achievements: Achievement[];
  nemesis: { opponentId: string; opponentName: string; wins: number; losses: number } | null;
  opponents: { userId: string; name: string; timesPlayed: number }[];
};
