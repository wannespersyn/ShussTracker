import type { Reaction } from "@/lib/db/activity";

const PATHS: Record<Reaction, string> = {
  fire: "M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 2 0-2-1-4 0-6z",
  laugh: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14c1 2 2.5 3 4 3s3-1 4-3zM8.5 9.5h.01M15.5 9.5h.01",
  beer: "M6 7h10v13H6zM16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 4c2-1 4 1 5 0s3-1 5 1",
  skull: "M12 3a8 8 0 0 0-8 8c0 3 2 5 3 6v3h10v-3c1-1 3-3 3-6a8 8 0 0 0-8-8zM9 12h.01M15 12h.01M10 20v-2M14 20v-2",
};

export const REACTION_LABEL: Record<Reaction, string> = { fire: "Fire", laugh: "Laughing", beer: "Cheers", skull: "Dead" };

export function ReactionIcon({ reaction, className = "w-5 h-5" }: Readonly<{ reaction: Reaction; className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[reaction]} />
    </svg>
  );
}
