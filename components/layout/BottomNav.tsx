"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { GroupIcon, HomeIcon, PlusIcon, UserIcon } from "../ui/icons";

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V11M10 20V5M16 20v-7M22 20H2" />
    </svg>
  );
}

function NavItem({
  href,
  label,
  active,
  icon,
}: Readonly<{ href: string; label: string; active: boolean; icon: React.ReactNode }>) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "h-16 flex flex-col items-center justify-center gap-0.75 font-body font-bold text-[10px] tracking-[0.06em] uppercase",
        active ? "text-nav-active font-extrabold" : "text-muted",
      )}
    >
      <span className="w-5.5 h-5.5 [&>svg]:w-full [&>svg]:h-full">{icon}</span>
      {label}
    </Link>
  );
}

/** v2 floating scoreboard tab bar: Home · Crew · [+ Log] · Stats · Me.
 * Duos live on the crew board (Players / Duos) and at /duos.
 * Hidden during immersive full-bleed flows with their own primary CTA:
 * the log-a-game wizard, tournament match play and the recap slides. */
export function BottomNav({ currentUserId }: Readonly<{ currentUserId: string }>) {
  const pathname = usePathname();
  const { t } = useT();

  if (
    pathname.startsWith("/log") ||
    /\/tournaments\/[^/]+\/match\//.test(pathname) ||
    pathname === "/americano/new" ||
    /\/americano\/[^/]+\/game\//.test(pathname) ||
    /\/americano\/[^/]+\/tv$/.test(pathname) ||
    /\/americano\/[^/]+\/manage$/.test(pathname) ||
    pathname.endsWith("/recap") ||
    pathname.startsWith("/game/") ||
    pathname.endsWith("/sessions") ||
    pathname === "/settings" ||
    pathname === "/feedback" ||
    pathname.endsWith("/manage") ||
    pathname.startsWith("/chwazi") ||
    pathname.startsWith("/camera") ||
    pathname === "/crews/join" ||
    pathname.includes("/vs/") ||
    pathname.endsWith("/achievements")
  ) {
    return null;
  }

  const profileHref = `/players/${currentUserId}`;

  return (
    <nav
      aria-label={t.more.mainNav}
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: "calc(22px + env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-md h-[66px] rounded-[22px] bg-surface-nav/95 backdrop-blur border border-line-strong grid grid-cols-5 items-center shadow-elevation-md">
        <NavItem href="/home" label={t.nav.home} active={pathname === "/home"} icon={<HomeIcon />} />
        <NavItem
          href="/crews"
          label={t.nav.crew}
          active={pathname === "/crews" || pathname.startsWith("/crews/")}
          icon={<GroupIcon />}
        />
        <Link href="/log" aria-label={t.nav.log} className="h-16 flex items-center justify-center">
          <span className="w-12 h-12 rounded-lg bg-amber text-ink flex items-center justify-center transition-transform active:scale-95 [&>svg]:w-6 [&>svg]:h-6">
            <PlusIcon />
          </span>
        </Link>
        <NavItem href="/stats" label={t.nav.stats} active={pathname === "/stats"} icon={<StatsIcon />} />
        <NavItem href={profileHref} label={t.nav.me} active={pathname.startsWith("/players/")} icon={<UserIcon />} />
      </div>
    </nav>
  );
}
