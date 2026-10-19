import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import { FormDots, Panel, Screen } from "@/components/v2";

export default async function CrewsPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [crews, t] = await Promise.all([getUserCrews(userId), getT()]);
  const insights = await Promise.all(crews.map((c) => getCrewInsights(c.id)));

  return (
    <Screen>
      <header className="flex items-center justify-between h-11">
        <h1 className="font-display font-extrabold text-[34px] tracking-[0.02em] uppercase">{t.crews.title}</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/crews/join"
            className="h-9 px-3 rounded-pill bg-surface-panel border border-line-strong text-cream font-body font-semibold text-[13px] flex items-center"
          >
            {t.join.join}
          </Link>
          <Link
            href="/crews/join?mode=new"
            aria-label={t.join.startNew}
            className="w-11 h-11 rounded-pill bg-amber text-ink flex items-center justify-center"
          >
            <PlusIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {crews.length === 0 ? (
        <Panel className="text-center py-8 flex flex-col items-center gap-2">
          <div className="font-display font-extrabold text-3xl uppercase">{t.crews.none}</div>
          <p className="font-body text-sm text-muted max-w-70">{t.crews.noneBody}</p>
        </Panel>
      ) : (
        crews.map((c, i) => {
          const me = insights[i].players.find((p) => p.userId === userId);
          const ranked = insights[i].players.filter((p) => p.games > 0).length;
          return (
            <Link
              key={c.id}
              href={`/crews/${c.id}`}
              className="flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-surface-deep border border-line text-cream"
            >
              <span className="w-11 h-11 shrink-0 rounded-md bg-surface-raised text-gold flex items-center justify-center font-display font-extrabold text-base uppercase">
                {c.name.slice(0, 2)}
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-body font-semibold text-[15px] truncate">{c.name}</span>
                <span className="flex items-center gap-2 font-body text-xs text-muted">
                  {format(t.crews.members, { n: c.members, g: c.games })}
                  {me && me.games > 0 && <FormDots form={me.form.slice(-5)} />}
                </span>
              </span>
              {me && me.games > 0 && (
                <span className="font-heading font-bold text-[15px] text-gold whitespace-nowrap">{format(t.crews.rank, { r: me.rank, n: ranked })}</span>
              )}
              <ChevronRightIcon className="w-4 h-4 text-muted" />
            </Link>
          );
        })
      )}
    </Screen>
  );
}
