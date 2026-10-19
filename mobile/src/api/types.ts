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
  mamaA: number;
  mamaB: number;
  bestWinStreak: number;
  streak: Streak | null;
  recent: { gameId: string; playedAt: string; won: boolean; opponents: string; mama: number; streakAfter: number }[];
};

export type SessionInsight = {
  /** YYYY-MM-DD of the night (games before 06:00 count for the evening before). */
  night: string;
  games: number;
  players: number;
  mvp: { userId: string; name: string; wins: number; eloDelta: number } | null;
  movers: { userId: string; name: string; delta: number }[];
  mamaKings: { names: string[]; count: number } | null;
  ironLiver: { name: string; games: number } | null;
  duoOfNight: { names: string; wins: number; losses: number } | null;
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
  tournaments: { id: string; name: string; format: string; status: "setup" | "active" | "completed"; createdAt: string }[];
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

export type StatsFieldCounts = { far: number; mid: number; near: number; risk: number; miss: number };
export type StatsGame = {
  id: string;
  crewId: string | null;
  matType: "2" | "4" | "8";
  playedAt: string;
  teams: { userIds: string[]; won: boolean; points: number; shots: Record<string, StatsFieldCounts> }[];
};
export type StatsData = {
  people: { id: string; name: string }[];
  crews: { id: string; name: string; memberCount: number }[];
  games: StatsGame[];
  hasZoneData: boolean;
};

export type HeadToHead = {
  a: { id: string; name: string | null; stats: PlayerInsight | null };
  b: { id: string; name: string | null; stats: PlayerInsight | null };
  crew: { id: string; name: string } | null;
  aWins: number;
  bWins: number;
  meetings: { gameId: string; playedAt: string; aWon: boolean; aScore: number; bScore: number; matType: "2" | "4" | "8" }[];
};

export type TournamentFormat = "single_elim" | "double_elim" | "round_robin";
export type TournamentEntrant = { id: string; seed: number; names: string; playerIds: [string, string] };
export type TournamentMatch = {
  id: string;
  bracket: "winners" | "losers" | "grand_final" | "round_robin";
  round: number;
  slot: number;
  entrantA: TournamentEntrant | null;
  entrantB: TournamentEntrant | null;
  winnerEntrantId: string | null;
  gameId: string | null;
};
export type Tournament = {
  id: string;
  name: string;
  format: TournamentFormat;
  status: "setup" | "active" | "completed";
  groupId: string;
  groupName: string;
  winnersRounds: TournamentMatch[][];
  losersRounds: TournamentMatch[][];
  grandFinal: TournamentMatch | null;
  roundRobinRounds: TournamentMatch[][];
  standings: { entrant: TournamentEntrant; wins: number; played: number }[];
  championEntrant: TournamentEntrant | null;
};

export type RecapStory = { kicker: string; big: string; bigSize: number; line: string; foot: string; tone: "amber" | "ink" | "panel" | "red" };
export type Recap = {
  crewName: string;
  monthly: { month: string; slides: RecapStory[] } | null;
  season: {
    label: string;
    showedUp: { games: number; nights: number };
    biggestWin: { winnerNames: string; loserNames: string; margin: number } | null;
    bestDuo: { names: string; wins: number; losses: number } | null;
    redZones: { name: string; count: number } | null;
    topScorer: { name: string; points: number } | null;
    mostGames: { name: string; games: number } | null;
  };
};

export type Idea = {
  id: string;
  text: string;
  status: "new" | "under_review" | "planned" | "in_progress" | "done" | "declined";
  votes: number;
  votedByMe: boolean;
  mine: boolean;
};
