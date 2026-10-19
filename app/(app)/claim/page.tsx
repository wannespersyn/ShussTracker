import { requireSession } from "@/lib/db/authz";
import { BackButton } from "@/components/ui";
import { ClaimGuestForm } from "@/components/crews/ClaimGuestForm";
import { getT } from "@/lib/i18n/server";

export default async function ClaimGuestPage({ searchParams }: Readonly<{ searchParams: Promise<{ code?: string }> }>) {
  await requireSession();
  const { code } = await searchParams;
  const t = await getT();

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-8">
      <header className="flex items-center gap-3.5">
        <BackButton href="/home" />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-muted">
            {t.claim.kicker}
          </div>
          <div className="font-display text-display-sm text-cream mt-1">{t.claim.title}</div>
        </div>
      </header>

      <div className="font-body text-body-sm text-muted">
        {t.claim.body}
      </div>

      <ClaimGuestForm defaultCode={code?.toUpperCase().slice(0, 6)} />
    </div>
  );
}
