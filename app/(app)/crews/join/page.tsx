import { redirect } from "next/navigation";
import { requireSession } from "@/lib/db/authz";
import { joinCrewByCode } from "@/lib/db/crews";
import { JoinCrewForm } from "@/components/crews/JoinCrewForm";

export default async function JoinCrewPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  let initialError: string | undefined;
  if (code) {
    const session = await requireSession();
    const result = await joinCrewByCode(session.user.id, code);
    if (result.groupId) redirect(`/crews/${result.groupId}`);
    initialError = result.error;
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header>
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
          Join a crew
        </div>
        <div className="font-display text-display-sm text-cream mt-1">Got a code?</div>
      </header>
      <JoinCrewForm initialError={initialError} />
    </div>
  );
}
