/**
 * Americano / Mexicano page — Route: /americano/[rotationId]?tab=
 *
 * The live night from the "Shussapp Americano" design: header, round
 * progress and three tabs — Live (mats, sit-outs, queue, top 3), Standings
 * (podium + table) and Rounds. Once it's done: champion, awards and final
 * standings. Requires crew membership.
 */
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getRotation } from "@/lib/db/rotations";
import { firstName } from "@/lib/insights";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { Screen } from "@/components/v2";
import { ConfirmForm } from "@/components/ui";
import { ShareButton } from "@/components/game/ShareButton";
import Link from "next/link";
import {
  FinalView,
  LiveTab,
  Podium,
  RotationHeader,
  RotationTabs,
  RoundProgress,
  RoundsTab,
  StandingsTable,
  type RotationTab,
} from "@/components/rotation/RotationScreens";
import { finishRotationAction } from "../actions";

export default async function RotationPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ rotationId: string }>; searchParams: Promise<{ tab?: string }> }>) {
  const [{ rotationId }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const session = await requireSession();
  const userId = session.user.id;
  const rotation = await getRotation(rotationId);
  if (!rotation) notFound();
  try {
    await requireGroupMember(userId, rotation.groupId);
  } catch {
    notFound();
  }
  const [t, crew] = await Promise.all([getT(), db.query.groups.findFirst({ where: eq(groups.id, rotation.groupId), columns: { createdBy: true } })]);
  const R = t.rot;
  const nameOf = new Map(rotation.players.map((p) => [p.id, firstName(p.name)]));
  const name = (id: string) => nameOf.get(id) ?? t.more.player;
  const base = `/americano/${rotation.id}`;
  const live = rotation.status !== "completed";
  const tab: RotationTab = tabParam === "standings" || tabParam === "rounds" ? tabParam : "live";
  const mayFinish = live && (rotation.createdBy === userId || crew?.createdBy === userId);
  const champ = rotation.standings.find((s) => s.games > 0);

  const finish = mayFinish ? (
    <div className="flex justify-center pt-1">
      <ConfirmForm action={finishRotationAction.bind(null, rotation.id)} confirmMessage={R.finishConfirm}>
        <button type="submit" className="h-10 px-4 rounded-pill border border-red-pale/45 text-red-pale font-heading font-bold text-sm tracking-[0.08em]">
          {R.finish}
        </button>
      </ConfirmForm>
    </div>
  ) : undefined;

  const endActions = (
    <div className="flex flex-col gap-2.5">
      <ShareButton
        label={R.share}
        cta={R.share}
        copiedLabel={R.copied}
        title={format(R.shareTitle, { name: rotation.name, champ: champ ? name(champ.userId) : "" })}
        className="w-full h-14 rounded-[16px] bg-amber text-ink flex items-center justify-center font-heading font-extrabold text-[19px] tracking-[0.06em]"
      />
      <Link
        href={`/americano/new?crewId=${rotation.groupId}&players=${rotation.players.map((p) => p.id).join(",")}`}
        className="h-12.5 rounded-[16px] bg-surface-deep border border-line-strong text-cream flex items-center justify-center font-heading font-extrabold text-[17px] tracking-[0.06em]"
      >
        {R.again}
      </Link>
    </div>
  );

  return (
    <Screen className="gap-4.5">
      <RotationHeader v={rotation} R={R} backHref={`/crews/${rotation.groupId}`} backLabel={t.common.back} tvHref={live ? `${base}/tv` : undefined} />
      {live && <RoundProgress v={rotation} R={R} />}
      <RotationTabs base={base} tab={tab} R={R} />

      {tab === "live" &&
        (live ? (
          <LiveTab v={rotation} R={R} name={name} base={base} userId={userId} />
        ) : (
          <FinalView v={rotation} R={R} name={name} userId={userId} actions={endActions} />
        ))}

      {tab === "standings" && (
        <>
          <Podium top={rotation.standings.slice(0, 3)} name={name} />
          <StandingsTable v={rotation} R={R} name={name} userId={userId} />
          <p className="font-body text-[13px] leading-[1.45] text-muted">{R.rankHow}</p>
        </>
      )}

      {tab === "rounds" && <RoundsTab v={rotation} R={R} name={name} finishSlot={finish} />}
    </Screen>
  );
}
