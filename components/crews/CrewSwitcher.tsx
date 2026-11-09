/**
 * CrewSwitcher
 *
 * A row of crew chips (only when the viewer is in 2+ crews). Tapping one
 * remembers it as the active crew and reloads `next` for that crew.
 *
 * Data: the viewer's crews + the current one; posts to switchCrewAction.
 */
import { switchCrewAction } from "@/app/(app)/crews/active-crew-actions";
import { cn } from "@/lib/cn";

export function CrewSwitcher({
  crews,
  currentId,
  next,
  label,
  tone = "app",
}: Readonly<{ crews: { id: string; name: string }[]; currentId: string | undefined; next: string; label: string; tone?: "app" | "overlay" }>) {
  if (crews.length < 2) return null;
  return (
    <nav aria-label={label} className="flex gap-1.5 overflow-x-auto -mx-5 px-5">
      {crews.map((c) => {
        const active = c.id === currentId;
        return (
          <form key={c.id} action={switchCrewAction} className="shrink-0">
            <input type="hidden" name="crewId" value={c.id} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              aria-current={active ? "true" : undefined}
              className={cn(
                "h-8 px-3 rounded-sm flex items-center font-heading font-bold text-sm tracking-[0.06em] uppercase whitespace-nowrap",
                tone === "overlay"
                  ? active
                    ? "bg-black/80 text-white"
                    : "bg-black/15 text-current border border-current/30"
                  : active
                    ? "bg-surface-raised text-cream border border-gold/50"
                    : "text-muted border border-line",
              )}
            >
              {c.name}
            </button>
          </form>
        );
      })}
    </nav>
  );
}
