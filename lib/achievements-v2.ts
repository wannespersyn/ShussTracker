import type { DuoInsight, PlayerInsight, SessionInsight } from "@/lib/insights";
import { firstName } from "@/lib/insights";

/* v2 achievements: 16 badges in four categories, each with progress, all
 * derived from the crew insights (so they always agree with the other
 * screens). Copy is English-only for now, like the mockup. */

export type AchievementCat = "streak" | "games" | "shots" | "social";
export type AchievementIcon = "flame" | "bolt" | "crown" | "star" | "target";
export type AchievementV2 = {
  id: string;
  cat: AchievementCat;
  name: string;
  desc: string;
  icon: AchievementIcon;
  have: number;
  need: number;
  got: boolean;
};

export function achievementsFor(
  p: PlayerInsight,
  ctx: { duos: DuoInsight[]; sessions: SessionInsight[]; reactions: number; crewName: string; now: Date },
): AchievementV2[] {
  const myDuos = ctx.duos.filter((d) => d.a.id === p.userId || d.b.id === p.userId);
  const bestDuo = [...myDuos].sort((a, b) => b.bestWinStreak - a.bestWinStreak)[0];
  const partner = bestDuo ? (bestDuo.a.id === p.userId ? bestDuo.b : bestDuo.a) : null;

  // Most mama in the crew this calendar month.
  const month = ctx.now.toISOString().slice(0, 7);
  const mamaThisMonth = new Map<string, number>();
  for (const s of ctx.sessions) if (s.night.startsWith(month)) for (const l of s.lines) mamaThisMonth.set(l.userId, (mamaThisMonth.get(l.userId) ?? 0) + l.mama);
  const myMonth = mamaThisMonth.get(p.userId) ?? 0;
  const topMonth = Math.max(0, ...mamaThisMonth.values());
  const chug = myMonth > 0 && myMonth === topMonth ? 1 : 0;

  const best = p.bestWinStreak;
  const list: Omit<AchievementV2, "got">[] = [
    { id: "hot-hand", cat: "streak", name: "Hot Hand", desc: "3 wins in a row", icon: "flame", have: best, need: 3 },
    { id: "on-a-roll", cat: "streak", name: "On A Roll", desc: "5 wins in a row", icon: "flame", have: best, need: 5 },
    { id: "unstoppable", cat: "streak", name: "Unstoppable", desc: `10 wins in a row · best: ${best}`, icon: "bolt", have: best, need: 10 },
    {
      id: "untouchable-duo",
      cat: "streak",
      name: "Untouchable Duo",
      desc: partner ? `Duo wins 8 in a row — you & ${firstName(partner.name)} hit ${bestDuo!.bestWinStreak}` : "Duo wins 8 in a row",
      icon: "crown",
      have: bestDuo?.bestWinStreak ?? 0,
      need: 8,
    },
    { id: "streak-breaker", cat: "streak", name: "Streak Breaker", desc: "End someone’s 5+ streak", icon: "target", have: p.feats.streakBreaks, need: 1 },
    { id: "comeback", cat: "streak", name: "Comeback Kid", desc: "Win after 4 losses", icon: "star", have: p.feats.comeback ? 1 : 0, need: 1 },
    { id: "first-flick", cat: "games", name: "First Flick", desc: "Log your first game", icon: "star", have: p.games, need: 1 },
    { id: "regular", cat: "games", name: "Regular", desc: "Play 10 games", icon: "star", have: p.games, need: 10 },
    { id: "veteran", cat: "games", name: "Veteran", desc: "Play 50 games", icon: "star", have: p.games, need: 50 },
    { id: "legend", cat: "games", name: "Legend", desc: "Play 100 games", icon: "crown", have: p.games, need: 100 },
    { id: "sharpshooter", cat: "shots", name: "Sharpshooter", desc: "3 mama in one game", icon: "target", have: p.feats.maxMamaGame, need: 3 },
    { id: "dead-eye", cat: "shots", name: "Dead Eye", desc: "5 mama in one night", icon: "target", have: p.feats.maxMamaNight, need: 5 },
    { id: "red-zone", cat: "shots", name: "Red Zone Regular", desc: "25 mama total", icon: "target", have: p.mama, need: 25 },
    { id: "chug", cat: "shots", name: "Chug Champion", desc: `Most mama in ${ctx.crewName} this month`, icon: "crown", have: chug, need: 1 },
    { id: "mvp", cat: "social", name: "Session MVP", desc: "Most wins in a night", icon: "star", have: p.feats.mvpNights, need: 1 },
    { id: "crowd", cat: "social", name: "Crowd Favourite", desc: "50 reactions on your games", icon: "flame", have: ctx.reactions, need: 50 },
  ];
  return list.map((a) => ({ ...a, got: a.have >= a.need }));
}

export const ACHIEVEMENT_ICON_PATH: Record<AchievementIcon, string> = {
  flame: "M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 2 0-2-1-4 0-6z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
};
