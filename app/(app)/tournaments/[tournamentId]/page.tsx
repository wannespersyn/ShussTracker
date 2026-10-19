/**
 * Tournament page — Route: /tournaments/[tournamentId] (server component)
 *
 * Shows a tournament's bracket (or round-robin standings), the champion and
 * the next playable match. Requires crew membership.
 *
 * Notes: round/bracket labels come from the dictionary (t.tour).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getTournament, type TournamentEntrantView, type TournamentMatchView } from "@/lib/db/tournaments";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { Kicker, Screen } from "@/components/v2";
import { getT } from "@/lib/i18n/server";
import { format, type Dictionary } from "@/lib/i18n";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (e: TournamentEntrantView | null, tbd = "—") => (e ? e.names.split(" & ").map((n) => cap(firstName(n))).join(" & ") : tbd);

export default async function TournamentPage({ params }: Readonly<{ params: Promise<{ tournamentId: string }> }>) {
  const { tournamentId } = await params;
  const session = await requireSession();
  const t = await getT();
  const T = t.tour;

  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();
  try {
    await requireGroupMember(session.user.id, tournament.groupId);
  } catch {
    notFound();
  }

  const all: { m: TournamentMatchView; label: string }[] = [
    ...tournament.winnersRounds.flatMap((r, i, rs) => r.map((m, k) => ({ m, label: elimLabel(i, rs.length, k, r.length, T) }))),
    ...tournament.losersRounds.flatMap((r, i) => r.map((m) => ({ m, label: format(T.losersRound, { n: i + 1 }) }))),
    ...(tournament.grandFinal ? [{ m: tournament.grandFinal, label: T.grandFinal }] : []),
    ...tournament.roundRobinRounds.flatMap((r, i) => r.map((m) => ({ m, label: format(T.round, { n: i + 1 }) }))),
  ];
  const upNext = all.find((x) => x.m.entrantA && x.m.entrantB && !x.m.gameId);
  const entrantCount = new Set(all.flatMap((x) => [x.m.entrantA?.id, x.m.entrantB?.id]).filter(Boolean)).size;
  const live = tournament.status !== "completed";

  return (
    <Screen className="gap-4">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/crews/${tournament.groupId}`}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 min-w-0 flex flex-col">
          <h1 className="font-display font-extrabold text-[22px] tracking-[0.04em] uppercase truncate">{tournament.name}</h1>
          <span className="font-body text-xs text-muted truncate">
            {format(T.meta, {
              format: { single_elim: T.formatSingle, double_elim: T.formatDouble, round_robin: T.formatRobin }[tournament.format],
              n: entrantCount,
              crew: tournament.groupName,
            })}
          </span>
        </span>
        {live ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1.25 rounded-sm bg-red text-ink font-heading font-extrabold text-[13px] tracking-[0.12em]">
            <span className="w-1.75 h-1.75 rounded-pill bg-ink" />
            {T.live}
          </span>
        ) : (
          <span className="px-2.5 py-1.25 rounded-sm bg-surface-raised text-muted font-heading font-extrabold text-[13px] tracking-[0.12em]">{T.done}</span>
        )}
      </header>

      {tournament.championEntrant && (
        <section className="rounded-[18px] bg-amber text-ink px-4.5 py-4 flex items-center gap-3.5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
          </svg>
          <span className="flex flex-col">
            <span className="font-heading font-bold text-[13px] tracking-[0.16em]">{T.champions}</span>
            <span className="font-display font-extrabold text-[30px] leading-none uppercase">{short(tournament.championEntrant)}</span>
          </span>
        </section>
      )}

      {tournament.format === "round_robin" ? (
        <section aria-label={T.standings} className="rounded-[18px] bg-surface-deep border border-line overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-line">
            <Kicker>{T.standings}</Kicker>
          </div>
          {tournament.standings.map((row, i) => (
            <div key={row.entrant.id} className="flex items-center gap-3 min-h-12 px-3.5 border-b border-cream/5 last:border-b-0">
              <span className={cn("w-5 font-display font-extrabold text-lg", i === 0 ? "text-gold" : "text-muted")}>{i + 1}</span>
              <span className="flex-1 font-body font-semibold text-[15px] truncate">{short(row.entrant)}</span>
              <span className="font-display font-bold text-[17px] tabular-nums">
                {row.wins}–{row.played - row.wins}
              </span>
            </div>
          ))}
        </section>
      ) : (
        <Bracket rounds={tournament.winnersRounds} tournamentId={tournament.id} title={tournament.format === "double_elim" ? T.winners : undefined} t={t} />
      )}
      {tournament.format === "double_elim" && tournament.losersRounds.length > 0 && (
        <Bracket rounds={tournament.losersRounds} tournamentId={tournament.id} title={T.losers} t={t} />
      )}
      {tournament.grandFinal && (
        <div className="flex flex-col gap-2">
          <Kicker className="text-gold">{T.grandFinal}</Kicker>
          <MatchBox match={tournament.grandFinal} tournamentId={tournament.id} tbd={T.tbd} final />
        </div>
      )}

      {upNext && (
        <section aria-label={T.upNext} className="flex flex-col gap-2.5 p-4 rounded-[18px] bg-surface-raised border border-gold/40">
          <Kicker>{format(T.upNextLabel, { label: upNext.label })}</Kicker>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <span className="font-heading font-bold text-xl uppercase">{short(upNext.m.entrantA)}</span>
            <span className="font-display font-extrabold text-lg text-[#5b6460]">{T.vs}</span>
            <span className="font-heading font-bold text-xl uppercase text-right">{short(upNext.m.entrantB)}</span>
          </div>
          <Link
            href={`/tournaments/${tournament.id}/match/${upNext.m.id}`}
            className="h-13 rounded-[14px] bg-amber text-ink flex items-center justify-center font-heading font-extrabold text-[19px] tracking-[0.06em]"
          >
            {T.play}
          </Link>
        </section>
      )}

      {tournament.format === "round_robin" && (
        <div className="flex flex-col gap-3">
          {tournament.roundRobinRounds.map((round, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Kicker>{format(T.round, { n: i + 1 })}</Kicker>
              {round.map((m) => (
                <MatchBox key={m.id} match={m} tournamentId={tournament.id} tbd={T.tbd} />
              ))}
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

function elimLabel(i: number, total: number, k: number, count: number, T: Dictionary["tour"]) {
  const name = i === total - 1 ? T.final : i === total - 2 ? T.semi : i === total - 3 ? T.quarter : format(T.round, { n: i + 1 });
  return count > 1 ? `${name} ${k + 1}` : name;
}

function Bracket({ rounds, tournamentId, title, t }: Readonly<{ rounds: TournamentMatchView[][]; tournamentId: string; title?: string; t: Dictionary }>) {
  if (rounds.length === 0) return null;
  const T = t.tour;
  const roundName = (i: number) =>
    i === rounds.length - 1 ? T.finalUp : i === rounds.length - 2 ? T.semisUp : i === rounds.length - 3 ? T.quartersUp : format(T.roundUp, { n: i + 1 });
  return (
    <section aria-label={title ?? T.bracket} className="flex flex-col gap-2">
      {title && <Kicker>{title}</Kicker>}
      <div className="rounded-[18px] bg-surface-deep border border-line px-3 py-3.5 overflow-x-auto">
        <div className="flex items-stretch gap-0" style={{ minWidth: rounds.length > 2 ? rounds.length * 160 : undefined }}>
          {rounds.map((round, i) => (
            <div key={i} className="flex items-stretch flex-1 min-w-0">
              {i > 0 && (
                <div aria-hidden="true" className="w-5.5 shrink-0 flex flex-col justify-around pt-4.5">
                  {round.map((m) => (
                    <div key={m.id} className="h-1/2 border-2 border-l-0 border-[#3a4144] rounded-r-[10px]" style={{ height: `${50 / round.length}%` }} />
                  ))}
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <span className={cn("font-heading font-semibold text-[11px] tracking-[0.14em]", i === rounds.length - 1 ? "text-gold" : "text-muted")}>
                  {roundName(i)}
                </span>
                <div className="flex-1 flex flex-col justify-around gap-7">
                  {round.map((m) => (
                    <MatchBox key={m.id} match={m} tournamentId={tournamentId} tbd={T.tbd} final={i === rounds.length - 1} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MatchBox({ match: m, tournamentId, tbd, final = false }: Readonly<{ match: TournamentMatchView; tournamentId: string; tbd: string; final?: boolean }>) {
  const playable = m.entrantA && m.entrantB && !m.gameId;
  const box = (
    <div className={cn("flex flex-col rounded-[10px] overflow-hidden", final ? "border-2 border-gold" : "border border-cream/10")}>
      <Side entrant={m.entrantA} tbd={tbd} win={m.winnerEntrantId ? m.winnerEntrantId === m.entrantA?.id : null} />
      <Side entrant={m.entrantB} tbd={tbd} win={m.winnerEntrantId ? m.winnerEntrantId === m.entrantB?.id : null} border />
    </div>
  );
  return playable ? <Link href={`/tournaments/${tournamentId}/match/${m.id}`} className="text-cream">{box}</Link> : box;
}

function Side({ entrant, tbd, win, border = false }: Readonly<{ entrant: TournamentEntrantView | null; tbd: string; win: boolean | null; border?: boolean }>) {
  return (
    <div
      className={cn(
        "flex justify-between items-center gap-2 h-10 px-2.5 font-body font-semibold text-[13px]",
        border && "border-t border-line",
        win === true ? "bg-amber text-ink" : win === false ? "bg-surface-raised text-[#6b746f]" : "bg-surface-raised",
        !entrant && "text-muted",
      )}
    >
      <span className="truncate">{short(entrant, tbd)}</span>
      <span className={cn("font-heading font-extrabold", win === null && "text-muted")}>{win === true ? "W" : win === false ? "L" : "—"}</span>
    </div>
  );
}
