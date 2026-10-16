"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { ChartIcon, GroupIcon, HomeIcon, PlusIcon, UserIcon } from "../ui/icons";

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
        active ? "text-gold" : "text-cream/55",
      )}
    >
      <span className="w-5.5 h-5.5 [&>svg]:w-full [&>svg]:h-full">{icon}</span>
      {label}
    </Link>
  );
}

/** v2 floating scoreboard tab bar: Home · Crew · [+ Log] · Stats · Me.
 * Hidden during immersive full-bleed flows with their own primary CTA:
 * the log-a-game wizard, tournament match play and the recap slides. */
export function BottomNav({ currentUserId }: Readonly<{ currentUserId: string }>) {
  const pathname = usePathname();
  const { t } = useT();

  if (
    pathname.startsWith("/log") ||
    /\/tournaments\/[^/]+\/match\//.test(pathname) ||
    pathname.endsWith("/recap")
  ) {
    return null;
  }

  const profileHref = `/players/${currentUserId}`;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-md h-16 rounded-[22px] bg-surface-panel/95 backdrop-blur border border-line grid grid-cols-5 items-center shadow-elevation-md">
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
        <NavItem href="/stats" label={t.nav.stats} active={pathname === "/stats"} icon={<ChartIcon />} />
        <NavItem href={profileHref} label={t.nav.me} active={pathname.startsWith("/players/")} icon={<UserIcon />} />
      </div>
    </nav>
  );
}
