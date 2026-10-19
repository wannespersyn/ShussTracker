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
