import { isAdminEmail } from "@/lib/admin";
import { requireSession } from "@/lib/db/authz";
import { BackButton, Card, LinkButton, PrimaryButton, SegmentedForm } from "@/components/ui";
import { signOutAction } from "@/app/(app)/actions";
import Link from "next/link";
import { getFlair, getLocale, getT, getTheme } from "@/lib/i18n/server";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { updateDisplayName } from "./actions";
import { setFlairAction, setLocaleAction, setThemeAction } from "./preferences-actions";

export default async function SettingsPage() {
  const session = await requireSession();
  const name = session.user.name ?? "";
  const email = session.user.email ?? "";
  const [t, theme, locale, flair] = await Promise.all([getT(), getTheme(), getLocale(), getFlair()]);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/players/${session.user.id}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Account
          </div>
          <div className="font-display font-extrabold text-display-sm text-cream mt-1 uppercase">{t.settings.title}</div>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <div className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">
          {t.settings.appearance}
        </div>
        <SegmentedForm
          action={setThemeAction}
          name="theme"
          value={theme}
          ariaLabel={t.settings.appearance}
          options={[
            { value: "system", label: t.settings.themeSystem },
            { value: "dark", label: t.settings.themeDark },
            { value: "light", label: t.settings.themeLight },
          ]}
        />
      </section>

      <form action={setFlairAction}>
        <input type="hidden" name="flair" value={flair ? "off" : "on"} />
        <button
          type="submit"
          aria-pressed={flair}
          className="w-full flex items-center gap-3 min-h-15 px-4 py-2 rounded-lg bg-surface-panel border border-line text-left"
        >
          <span className="flex-1 flex flex-col">
            <span className="font-body font-semibold text-[15px] text-cream">{t.settings.streakFlair}</span>
            <span className="font-body text-xs text-cream/55">{t.settings.streakFlairSub}</span>
          </span>
          <span className={`w-12 h-7 rounded-pill p-0.75 flex ${flair ? "bg-amber justify-end" : "bg-surface-raised justify-start"}`}>
            <span className={`w-5.5 h-5.5 rounded-pill ${flair ? "bg-ink" : "bg-cream/55"}`} />
          </span>
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <div className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">
          {t.settings.language}
        </div>
        <SegmentedForm
          action={setLocaleAction}
          name="locale"
          value={locale}
          ariaLabel={t.settings.language}
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
        />
      </section>

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

      <section className="flex flex-col gap-2">
        <div className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">{t.settings.help}</div>
        <div className="flex flex-col rounded-lg overflow-hidden bg-surface-panel border border-line">
          <Link href="/feedback?type=bug" className="min-h-13 px-4 flex items-center justify-between font-body font-semibold text-[15px] text-cream">
            {t.settings.feedback} <span className="text-cream/45">→</span>
          </Link>
          <Link href="/feedback?type=idea" className="min-h-13 px-4 flex items-center justify-between font-body font-semibold text-[15px] text-cream border-t border-line">
            {t.settings.feature} <span className="text-cream/45">→</span>
          </Link>
          {isAdminEmail(email) && (
            <Link href="/admin" className="min-h-13 px-4 flex items-center justify-between font-body font-semibold text-[15px] text-gold border-t border-line">
              Admin <span className="text-cream/45">→</span>
            </Link>
          )}
        </div>
      </section>

      <LinkButton href="/crews" variant="ghost">
        Manage your crews
      </LinkButton>

      <form action={signOutAction} className="mt-auto">
        <PrimaryButton type="submit" variant="outline" className="w-full">
          {t.settings.signOut}
        </PrimaryButton>
      </form>
    </div>
  );
}
