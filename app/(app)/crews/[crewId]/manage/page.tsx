import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groups, groupMembers } from "@/lib/db/schema";
import { requireSession, requireGroupOwner } from "@/lib/db/authz";
import { initialsFor } from "@/lib/format";
import { AutoSubmitToggle, AvatarChip, BackButton, Card, ConfirmForm, InfoButton, PrimaryButton } from "@/components/ui";
import {
  renameCrewAction,
  regenerateInviteCodeAction,
  removeCrewMemberAction,
  deleteCrewAction,
  setTrackShotZonesAction,
} from "./actions";

export default async function ManageCrewPage({ params }: { params: Promise<{ crewId: string }> }) {
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

  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, crewId),
    with: { user: true },
  });

  const renameAction = renameCrewAction.bind(null, crewId);
  const regenerateAction = regenerateInviteCodeAction.bind(null, crewId);
  const deleteAction = deleteCrewAction.bind(null, crewId);
  const trackShotZonesAction = setTrackShotZonesAction.bind(null, crewId);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/crews/${crewId}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Manage
          </div>
          <div className="font-display text-display-sm text-cream mt-1">{group.name}</div>
        </div>
      </header>

      <form action={renameAction} className="flex flex-col gap-2.5">
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
          Crew name
        </div>
        <input
          type="text"
          name="name"
          required
          defaultValue={group.name}
          className="h-13 rounded-lg bg-cream/8 px-4 font-body text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
        />
        <PrimaryButton type="submit" variant="outline">
          Save name
        </PrimaryButton>
      </form>

      <Card variant="flat" className="flex items-center justify-between gap-3">
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
            Invite code
          </div>
          <div className="font-display text-2xl text-cream tracking-[2px] mt-0.5">{group.inviteCode}</div>
        </div>
        <form action={regenerateAction}>
          <PrimaryButton type="submit" variant="ghost">
            Regenerate
          </PrimaryButton>
        </form>
      </Card>

      <form action={trackShotZonesAction}>
        <Card variant="flat" className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
              Track shot zones
            </div>
            <InfoButton ariaLabel="About tracking shot zones">
              Log which of the 1/2/3 fields a cap lands in, not just mama or miss. Off keeps logging to a single tap.
            </InfoButton>
          </div>
          <AutoSubmitToggle
            name="trackShotZones"
            defaultChecked={group.trackShotZones}
            ariaLabel="Track shot zones"
          />
        </Card>
      </form>

      <div className="flex flex-col gap-2.5">
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
          Members
        </div>
        {members.map((m) => {
          const removeAction = removeCrewMemberAction.bind(null, crewId, m.userId);
          const isOwner = m.userId === group.createdBy;
          const memberName = m.user.name ?? "Player";
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 rounded-xl bg-cream/5 border border-cream/10 px-3.5 py-3"
            >
              <AvatarChip initials={initialsFor(memberName)} size={38} />
              <div className="flex-1 min-w-0">
                <div className="font-body font-semibold text-[15px] text-cream truncate">{memberName}</div>
                {isOwner && (
                  <div className="font-heading font-bold text-[10.5px] tracking-[1.1px] uppercase text-gold">
                    Owner
                  </div>
                )}
              </div>
              {!isOwner && (
                <ConfirmForm action={removeAction} confirmMessage={`Remove ${memberName} from ${group.name}?`}>
                  <button
                    type="submit"
                    className="font-heading font-bold text-[12px] tracking-[1.2px] uppercase text-red-pale"
                  >
                    Remove
                  </button>
                </ConfirmForm>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmForm
        action={deleteAction}
        confirmMessage={`Delete ${group.name}? This can't be undone — members lose access, but past games stay on record.`}
        className="mt-auto"
      >
        <PrimaryButton type="submit" variant="outline" className="w-full">
          Delete crew
        </PrimaryButton>
      </ConfirmForm>
    </div>
  );
}
