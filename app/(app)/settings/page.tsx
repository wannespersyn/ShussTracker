import { requireSession } from "@/lib/db/authz";
import { BackButton, Card, LinkButton, PrimaryButton } from "@/components/ui";
import { signOutAction } from "@/app/(app)/actions";
import { updateDisplayName } from "./actions";

export default async function SettingsPage() {
  const session = await requireSession();
  const name = session.user.name ?? "";
  const email = session.user.email ?? "";

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/players/${session.user.id}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Account
          </div>
          <div className="font-display text-display-sm text-cream mt-1">Settings</div>
        </div>
      </header>

      <form action={updateDisplayName} className="flex flex-col gap-2.5">
        <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/45">
          Display name
        </div>
        <input
          type="text"
          name="name"
          required
          defaultValue={name}
          placeholder="Your name"
          className="h-13 rounded-lg bg-cream/8 px-4 font-body text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
        />
        <PrimaryButton type="submit" variant="outline">
          Save name
        </PrimaryButton>
      </form>

      <Card variant="flat">
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
          Signed in as
        </div>
        <div className="font-body text-body text-cream mt-1">{email || "No email on file"}</div>
      </Card>

      <LinkButton href="/crews" variant="ghost">
        Manage your crews
      </LinkButton>

      <form action={signOutAction} className="mt-auto">
        <PrimaryButton type="submit" variant="outline" className="w-full">
          Sign out
        </PrimaryButton>
      </form>
    </div>
  );
}
