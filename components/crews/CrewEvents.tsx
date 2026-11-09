/**
 * CrewEvents
 *
 * A crew's tournaments (brackets and Americano / Mexicano) as rows: live
 * ones with a LIVE chip, finished ones with the winner. Plus the two "start
 * a new one" buttons for the crew page.
 */
import Link from "next/link";
import type { CrewEvent } from "@/lib/db/crew-events";
import { ChevronRightIcon, TrophyIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { format, type Dictionary } from "@/lib/i18n";

export function CrewEventRow({ e, ev, date }: Readonly<{ e: CrewEvent; ev: Dictionary["ev"]; date: string }>) {
  return (
    <Link href={e.href} className="flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-surface-deep border border-line text-cream">
      <span className={cn("w-10 h-10 shrink-0 rounded-md flex items-center justify-center", e.live ? "bg-amber/14 text-gold" : "bg-surface-raised text-muted")}>
        {e.kind === "rotation" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h11l-3-3M20 17H9l3 3" />
          </svg>
        ) : (
          <TrophyIcon className="w-5 h-5" />
        )}
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-body font-semibold text-[15px] truncate">{e.name}</span>
        <span className="font-body text-xs text-muted truncate">
          {e.champion ? format(ev.won, { name: e.champion }) + " · " : ""}
          {format(ev.meta, { format: ev[e.format], n: e.players, date })}
        </span>
      </span>
      {e.live && (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-red text-ink font-heading font-extrabold text-[12px] tracking-[0.12em]">
          <span className="w-1.5 h-1.5 rounded-pill bg-ink" />
          {ev.live}
        </span>
      )}
      <ChevronRightIcon className="w-4 h-4 text-muted shrink-0" />
    </Link>
  );
}

export function NewEventButtons({ crewId, ev }: Readonly<{ crewId: string; ev: Dictionary["ev"] }>) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          [`/tournaments/new?crewId=${crewId}`, ev.newBracket, ev.newBracketSub],
          [`/americano/new?crewId=${crewId}`, ev.newRotation, ev.newRotationSub],
        ] as const
      ).map(([href, label, sub]) => (
        <Link key={href} href={href} className="flex flex-col gap-1 px-3.5 py-3 rounded-[16px] border border-dashed border-gold/45 text-cream">
          <span className="flex items-center gap-1.5 font-heading font-extrabold text-[15px] tracking-[0.08em] text-gold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {label}
          </span>
          <span className="font-body text-xs leading-snug text-muted">{sub}</span>
        </Link>
      ))}
    </div>
  );
}
