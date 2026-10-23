import Link from "next/link";
import type { ReactNode } from "react";
import { isAdminEmail } from "@/lib/admin";
import { requireSession } from "@/lib/db/authz";
import { getCrew, getUserCrews } from "@/lib/db/crew-insights";
import { SegmentedForm } from "@/components/ui";
import { Screen, Kicker } from "@/components/v2";
import { signOutAction } from "@/app/(app)/actions";
import { getFlair, getLocale, getT, getTheme } from "@/lib/i18n/server";
import { LOCALES } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";
import { updateDisplayName } from "./actions";
import { deleteAccountAction } from "./account-actions";
import { PushToggle } from "@/components/pwa/PushToggle";
import { pushPublicKey } from "@/lib/push";
import { setFlairAction, setLocaleAction, setThemeAction } from "./preferences-actions";
import { getBetaState } from "@/lib/db/beta";
import { newBetaCount } from "@/lib/beta";
import { format } from "@/lib/i18n";

export default async function SettingsPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const name = session.user.name ?? "";
  const email = session.user.email ?? "";
  const [t, theme, locale, flair, crews, beta] = await Promise.all([getT(), getTheme(), getLocale(), getFlair(), getUserCrews(userId), getBetaState(userId)]);
  const betaNew = newBetaCount(beta);
  const crew = crews[0];
  const crewInfo = crew ? await getCrew(crew.id) : null;
  const owns = crew && crew.createdBy === userId;
  const planLabel = crewInfo?.plan === "founding" ? "FOUNDING" : crewInfo?.plan === "pro" ? "PRO" : t.more.planFree;

  return (
    <Screen nav={false} className="gap-4 pb-6">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/players/${userId}`}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-cream/10 text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="font-display font-extrabold text-[26px] tracking-[0.04em] uppercase">{t.settings.title}</h1>
      </header>

      <Link href="/settings/beta" className="flex items-center gap-4 px-4 py-4.5 rounded-[18px] bg-amber" style={{ color: "#111" }}>
        <span className="w-12 h-12 shrink-0 rounded-[14px] bg-ink flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3M7.5 14h9" />
          </svg>
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-body font-bold text-[17px] leading-tight">{t.beta.title}</span>
            {betaNew > 0 && (
              <span className="inline-flex items-center h-5.5 px-2.5 rounded-pill font-heading font-bold text-[11px] leading-none tracking-[0.1em] whitespace-nowrap" style={{ backgroundColor: "#111", color: "#ffb627" }}>
                {format(t.beta.newCount, { n: betaNew })}
              </span>
            )}
          </span>
          <span className="font-body text-[13px] leading-snug">{beta.optIn ? t.beta.joinOn : t.beta.settingsRowSub}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      <section className="flex flex-col gap-2">
        <Kicker>{t.settings.appearance}</Kicker>
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
        <form action={setFlairAction}>
          <input type="hidden" name="flair" value={flair ? "off" : "on"} />
          <button
            type="submit"
            aria-pressed={flair}
            className="w-full flex items-center gap-3 min-h-15 px-4 py-2 rounded-[14px] bg-surface-panel border border-cream/10 text-left text-cream"
          >
            <span className="flex-1 flex flex-col">
              <span className="font-body font-semibold text-[15px]">{t.settings.streakFlair}</span>
              <span className="font-body font-medium text-xs text-muted">{t.settings.streakFlairSub}</span>
            </span>
            <span className={cn("w-12 h-7 rounded-pill p-0.75 flex", flair ? "bg-amber justify-end" : "bg-chip justify-start")}>
              <span className={cn("w-5.5 h-5.5 rounded-pill", flair ? "bg-ink" : "bg-muted")} />
            </span>
          </button>
        </form>
      </section>

      <PushToggle
        publicKey={pushPublicKey()}
        labels={{
          title: t.settings.push,
          on: t.settings.pushOn,
          off: t.settings.pushOff,
          denied: t.settings.pushDenied,
          iosInstall: t.settings.pushIos,
          unsupported: t.settings.pushUnsupported,
        }}
      />

      <section className="flex flex-col gap-2">
        <Kicker>{t.settings.language}</Kicker>
        <SegmentedForm
          action={setLocaleAction}
          name="locale"
          value={locale}
          ariaLabel={t.settings.language}
          options={LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
        />
      </section>

      <section className="flex flex-col gap-2">
        <Kicker>{t.settings.crewAccount}</Kicker>
        <Group>
          {crew && (
            <Row href={owns ? `/crews/${crew.id}/manage` : `/crews/${crew.id}`} value={<span className="font-body font-medium text-xs text-muted">{crew.name}</span>}>
              {owns ? t.settings.manageCrew : t.nav.crew}
            </Row>
          )}
          {crewInfo && (
            <Row
              href={`/crews/${crewInfo.id}`}
              value={<span className="font-heading font-bold text-[13px] tracking-[0.1em] text-gold">{planLabel}</span>}
            >
              {t.settings.subscription}
            </Row>
          )}
          <Row href="/crews" value={<span className="font-body font-medium text-xs text-muted">{crews.length}</span>}>
            {t.settings.yourCrews}
          </Row>
          <form action={updateDisplayName} className="flex items-center gap-2 min-h-13 pl-4 pr-2 border-t border-cream/10 first:border-t-0">
            <label htmlFor="display-name" className="sr-only">
              {t.settings.name}
            </label>
            <input
              id="display-name"
              type="text"
              name="name"
              required
              defaultValue={name}
              placeholder={t.settings.name}
              className="flex-1 min-w-0 h-11 bg-transparent font-body font-semibold text-[15px] text-cream placeholder:text-muted outline-none"
            />
            <button type="submit" className="h-9 px-3 rounded-sm bg-surface-raised border border-line-strong font-body font-semibold text-xs text-cream">
              {t.settings.save}
            </button>
          </form>
          <div className="min-h-13 px-4 flex items-center gap-3 border-t border-cream/10">
            <span className="flex-1 font-body font-semibold text-[15px]">{t.settings.signedIn}</span>
            <span className="font-body font-medium text-xs text-muted truncate max-w-44">{email}</span>
          </div>
        </Group>
      </section>

      <section className="flex flex-col gap-2">
        <Kicker>{t.settings.help}</Kicker>
        <Group>
          <Row href="/feedback?type=bug">{t.settings.feedback}</Row>
          <Row href="/feedback?type=idea">{t.settings.feature}</Row>
          <Row href="/privacy">{t.more.privacy}</Row>
          <Row href="/terms">{t.settings.terms}</Row>
          {isAdminEmail(email) && (
            <Row href="/admin" className="text-gold">
              Admin
            </Row>
          )}
        </Group>
      </section>

      <form action={signOutAction} className="mt-auto pt-2">
        <button
          type="submit"
          className="w-full h-12.5 rounded-[14px] border border-cream/10 font-body font-semibold text-[15px] text-red-pale"
        >
          {t.settings.signOut}
        </button>
      </form>

      <details className="group rounded-[14px] border border-cream/10 bg-surface-panel">
        <summary className="min-h-12 px-4 flex items-center justify-between cursor-pointer list-none font-body font-semibold text-sm text-muted">
          {t.settings.deleteAccount}
          <span className="text-muted group-open:rotate-90 transition-transform">›</span>
        </summary>
        <form action={deleteAccountAction} className="px-4 pb-4 flex flex-col gap-2.5">
          <p className="font-body text-[13px] leading-[1.4]! text-muted">{t.settings.deleteAccountBody}</p>
          <label htmlFor="confirm-delete" className="font-body font-semibold text-xs text-soft">
            {t.settings.deleteAccountType}
          </label>
          <input
            id="confirm-delete"
            name="confirm"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="DELETE"
            className="h-11 rounded-md bg-surface-raised border border-line px-3.5 font-heading font-bold tracking-[0.1em] text-cream placeholder:text-cream/25 outline-none"
          />
          <button type="submit" className="h-11 rounded-md bg-red text-ink font-heading font-extrabold text-sm tracking-[0.06em] uppercase">
            {t.settings.deleteAccountCta}
          </button>
        </form>
      </details>
    </Screen>
  );
}

function Group({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="flex flex-col rounded-[14px] overflow-hidden bg-surface-panel border border-cream/10">{children}</div>;
}

function Row({ href, value, className, children }: Readonly<{ href: string; value?: ReactNode; className?: string; children: ReactNode }>) {
  return (
    <Link
      href={href}
      className={cn(
        "min-h-13 px-4 flex items-center gap-3 font-body font-semibold text-[15px] text-cream border-t border-cream/10 first:border-t-0",
        className,
      )}
    >
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {value ?? <span className="font-body font-medium text-xs text-muted">→</span>}
    </Link>
  );
}
