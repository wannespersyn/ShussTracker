export type RivalryMeeting = { aWon: boolean };

export type RivalryInsight = { big: number; text: string; extended: boolean };

/** The one-line "what's the story" callout for a head-to-head or pinned
 * rivalry — a live win/loss streak beats a static score, and a static
 * score beats nothing. `extended` is true when the most recent meeting
 * grew the leading side's margin rather than closing it, standing in for
 * a push notification ("X just extended their lead") without needing any
 * notification infrastructure — the callout itself carries that signal
 * whenever it's rendered right after a new game.
 *
 * `aLabel`/`bLabel` are display-ready — a first name for a solo side, an
 * "A & B" pairing for a duo — the caller decides the formatting. */
export function rivalryInsight(
  meetings: RivalryMeeting[],
  aLabel: string,
  bLabel: string,
  aWins: number,
  bWins: number,
): RivalryInsight | null {
  if (meetings.length < 2) return null;

  let streak = 1;
  for (let i = 1; i < meetings.length; i++) {
    if (meetings[i].aWon === meetings[0].aWon) streak++;
    else break;
  }
  if (streak >= 2) {
    const winner = meetings[0].aWon ? aLabel : bLabel;
    return { big: streak, text: `${winner} has won ${streak} straight meetings in this rivalry.`, extended: true };
  }

  const gap = Math.abs(aWins - bWins);
  if (gap === 0) return { big: meetings.length, text: `Dead even after ${meetings.length} meetings.`, extended: false };

  const leading = aWins > bWins ? aLabel : bLabel;
  const trailing = aWins < bWins ? aLabel : bLabel;
  // The lead only "extended" if the most recent result went the leader's
  // way — a leader who just lost one is being caught up, not pulling away.
  const extended = meetings[0].aWon === aWins > bWins;
  return {
    big: gap,
    text: extended
      ? `${leading} just stretched the lead to ${gap}.`
      : `${trailing} needs ${gap} more win${gap === 1 ? "" : "s"} to level this up.`,
    extended,
  };
}
