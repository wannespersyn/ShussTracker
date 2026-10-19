import Link from "next/link";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { groups, groupMembers } from "@/lib/db/schema";
import { requireSession, requireGroupOwner } from "@/lib/db/authz";
import { getCrewInsights } from "@/lib/db/crew-insights";
import { getCrewGuests } from "@/lib/db/guests";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { AutoSubmitToggle, ConfirmForm } from "@/components/ui";
import { Avatar, Kicker, Screen } from "@/components/v2";
import { ShareButton } from "@/components/game/ShareButton";
import { renameCrewAction, regenerateInviteCodeAction, removeCrewMemberAction, deleteCrewAction, setTrackShotZonesAction } from "./actions";

export default async function ManageCrewPage({ params }: Readonly<{ params: Promise<{ crewId: string }> }>) {
  const { crewId } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  try {
    await requireGroupOwner(userId, crewId);
  } catch {
    notFound();
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, crewId) });
  if (!group) notFound();

  const [members, insights, guests, t, locale] = await Promise.all([
    db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, crewId), with: { user: true } }),
    getCrewInsights(crewId),
    getCrewGuests(crewId),
    getT(),
    getLocale(),
  ]);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "shussapp.vercel.app"}`;
  const inviteUrl = `${origin}/crews/join?code=${group.inviteCode}`;
  const qr = await QRCode.toString(inviteUrl, { type: "svg", margin: 0, color: { dark: "#0b0d0c", light: "#f3f1ea" } });

  const gamesOf = new Map(insights.players.map((p) => [p.userId, p.games]));
  const dateFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" });
  const guestCount = members.filter((m) => m.user.isGuest).length;
  const sorted = [...members].sort(
    (a, b) =>
      Number(b.userId === group.createdBy) - Number(a.userId === group.createdBy) ||
      Number(a.user.isGuest) - Number(b.user.isGuest) ||
      (gamesOf.get(b.userId) ?? 0) - (gamesOf.get(a.userId) ?? 0),
  );
  const topGuest = guests
    .filter((g) => g.claimToken)
    .map((g) => ({ ...g, games: gamesOf.get(g.id) ?? 0 }))
    .sort((a, b) => b.games - a.games)[0];

  return (
    <Screen nav={false} className="pb-6">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/crews/${crewId}`}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display font-extrabold text-[26px] tracking-[0.04em] uppercase truncate">{t.manage.title}</h1>
      </header>

      <section aria-label={t.manage.invite} className="flex gap-3.5 items-center p-3.5 rounded-[18px] bg-surface-deep border border-line">
        <div
          role="img"
          aria-label={t.manage.qr}
          className="w-[84px] h-[84px] shrink-0 rounded-[10px] bg-[#f3f1ea] p-1.5 [&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Kicker>{t.manage.invite}</Kicker>
            <form action={regenerateInviteCodeAction.bind(null, crewId)}>
              <button type="submit" className="font-body font-semibold text-xs text-muted underline-offset-2 hover:underline">
                {t.manage.newCode}
              </button>
            </form>
          </div>
          <span className="font-display font-extrabold text-[30px] leading-none tracking-[0.12em]">{group.inviteCode}</span>
          <ShareButton
            label={t.manage.share}
            copiedLabel={t.game.copied}
            title={format(t.manage.shareTitle, { crew: group.name })}
            url={inviteUrl}
            cta={t.manage.share}
            className="h-9 rounded-[10px] bg-amber text-ink font-body font-bold text-[13px]"
          />
        </div>
      </section>

      <form action={setTrackShotZonesAction.bind(null, crewId)}>
        <div className="flex items-center gap-3 min-h-15 px-3.5 py-2 rounded-[14px] bg-surface-deep border border-line">
          <span className="flex-1 flex flex-col">
            <span className="font-body font-semibold text-[15px]">{t.manage.track}</span>
            <span className="font-body text-xs text-muted">{t.manage.trackSub}</span>
          </span>
          <AutoSubmitToggle name="trackShotZones" defaultChecked={group.trackShotZones} ariaLabel={t.manage.track} />
        </div>
      </form>

      {topGuest && (
        <section aria-label={t.manage.guests} className="flex flex-col gap-2.5 p-3.5 rounded-[16px] bg-surface-raised border border-gold/35">
          <span className="font-body font-semibold text-[15px] leading-[1.35]!">
            {format(t.manage.guestCallout, { name: topGuest.name, n: topGuest.games })}
          </span>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              format(t.crew.claimMessage, {
                name: topGuest.name,
                crew: group.name,
                url: `${origin}/claim?code=${topGuest.claimToken}`,
                code: topGuest.claimToken ?? "",
              }),
            )}`}
            target="_blank"
            rel="noreferrer"
            className="h-11 rounded-md bg-amber text-ink font-body font-bold text-sm flex items-center justify-center"
          >
            {t.manage.whatsapp}
          </a>
        </section>
      )}

      <section aria-label={t.manage.members} className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <Kicker>{format(guestCount ? t.manage.membersGuests : t.manage.membersN, { n: members.length - guestCount, g: guestCount })}</Kicker>
          <Link
            href={`/crews/${crewId}#guests`}
            className="h-9 px-3 rounded-pill border border-dashed border-cream/25 text-cream font-body font-semibold text-[13px] flex items-center"
          >
            + {t.crew.addGuest}
          </Link>
        </div>
        {sorted.map((m) => {
          const isOwner = m.userId === group.createdBy;
          const isMe = m.userId === userId;
          const games = gamesOf.get(m.userId) ?? 0;
          const memberName = m.user.name ?? t.more.player;
          const sub = isOwner
            ? format(t.manage.created, { d: dateFmt.format(group.createdAt).replace("Sept", "Sep") })
            : m.user.isGuest
              ? format(t.manage.guestSub, { n: games })
              : isMe
                ? format(t.manage.youGames, { n: games })
                : format(t.manage.games, { n: games });
          return (
            <div key={m.userId} className="flex items-center gap-3 min-h-13 px-3 py-1.5 rounded-md bg-surface-deep border border-cream/6">
              <Avatar name={memberName} fontSize={11} />
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-body font-semibold text-[15px] truncate">{isMe && !isOwner ? memberName : firstName(memberName)}</span>
                <span className="font-body text-xs text-muted truncate">{isOwner && isMe ? `${t.common.you} · ${sub}` : sub}</span>
              </span>
              {isOwner ? (
                <Tag tone="admin">ADMIN</Tag>
              ) : (
                <>
                  {m.user.isGuest && <Tag tone="guest">{t.common.guest.toUpperCase()}</Tag>}
                  <ConfirmForm action={removeCrewMemberAction.bind(null, crewId, m.userId)} confirmMessage={format(t.manage.removeConfirm, { name: memberName, crew: group.name })}>
                    <button type="submit" aria-label={format(t.manage.remove, { name: memberName })} className="w-8 h-8 flex items-center justify-center text-muted">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </ConfirmForm>
                </>
              )}
            </div>
          );
        })}
      </section>

      <form action={renameCrewAction.bind(null, crewId)} className="flex items-center gap-2 min-h-13 pl-4 pr-2 rounded-[14px] bg-surface-deep border border-line">
        <label htmlFor="crew-name" className="font-body font-semibold text-[15px] text-muted shrink-0">
          {t.manage.name}
        </label>
        <input
          id="crew-name"
          type="text"
          name="name"
          required
          defaultValue={group.name}
          className="flex-1 min-w-0 h-11 bg-transparent font-body font-semibold text-[15px] text-cream outline-none"
        />
        <button type="submit" className="h-9 px-3 rounded-sm bg-surface-raised border border-line-strong font-body font-semibold text-xs text-cream">
          {t.settings.save}
        </button>
      </form>

      <ConfirmForm action={deleteCrewAction.bind(null, crewId)} confirmMessage={format(t.manage.deleteConfirm, { crew: group.name })} className="mt-auto pt-2">
        <button type="submit" className="w-full h-12 rounded-[14px] border border-red-pale/40 font-body font-semibold text-[15px] text-red-pale">
          {t.manage.delete}
        </button>
      </ConfirmForm>
    </Screen>
  );
}

function Tag({ tone, children }: Readonly<{ tone: "admin" | "guest"; children: string }>) {
  return (
    <span
      className={cn(
        "shrink-0 px-2 py-1 rounded-[6px] font-heading font-bold text-xs tracking-[0.1em]",
        tone === "admin" ? "bg-surface-raised text-gold border border-gold/40" : "bg-chip text-soft",
      )}
    >
      {children}
    </span>
  );
}
