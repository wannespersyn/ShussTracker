import { requireSession } from "@/lib/db/authz";
import { BackButton } from "@/components/ui";
import { ClaimGuestForm } from "@/components/crews/ClaimGuestForm";

export default async function ClaimGuestPage() {
  await requireSession();

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-8">
      <header className="flex items-center gap-3.5">
        <BackButton href="/home" />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Guest players
          </div>
          <div className="font-display text-display-sm text-cream mt-1">Claim your stats</div>
        </div>
      </header>

      <div className="font-body text-body-sm text-cream/55">
        Been logged as a guest at a game night? Enter the code whoever added you can hand over, and every game you
        already played gets folded into this account.
      </div>

      <ClaimGuestForm />
    </div>
  );
}
