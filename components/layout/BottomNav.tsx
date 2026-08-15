"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, GroupIcon, HomeIcon, PlusIcon, UserIcon } from "../ui/icons";

function NavItem({
  href,
  label,
  active,
  icon,
}: Readonly<{
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}>) {
  if (active) {
    return (
      <Link
        href={href}
        className="flex items-center gap-1.5 bg-gold text-ink rounded-pill px-3.5 py-2.5"
      >
        {icon}
        <span className="font-heading font-semibold text-[11px] tracking-[0.04em]">{label}</span>
      </Link>
    );
  }

  return (
    <Link href={href} className="flex items-center justify-center w-9 h-9 text-cream/45" aria-label={label}>
      {icon}
    </Link>
  );
}

/** Fixed bottom tab bar for the signed-in app shell — hidden during
 * immersive full-bleed flows with their own primary CTA or tap-to-advance
 * gestures the nav's floating FAB would otherwise sit on top of: the
 * log-a-game wizard, tournament match play (reuses that same wizard UI),
 * and the season-recap story slides. */
export function BottomNav({ currentUserId }: Readonly<{ currentUserId: string }>) {
  const pathname = usePathname();

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
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-5 gap-2"
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex-1 max-w-75 h-14.5 px-2 rounded-pill bg-surface-panel border border-cream/8 flex items-center justify-around">
        <NavItem href="/home" label="Home" active={pathname === "/home"} icon={<HomeIcon />} />
        <NavItem href="/stats" label="Stats" active={pathname === "/stats"} icon={<ChartIcon />} />
        <NavItem
          href="/crews"
          label="Crews"
          active={pathname === "/crews" || pathname.startsWith("/crews/")}
          icon={<GroupIcon />}
        />
        <NavItem
          href={profileHref}
          label="Profile"
          active={pathname.startsWith("/players/")}
          icon={<UserIcon />}
        />
      </div>

      <Link
        href="/log"
        aria-label="Log a game"
        className="w-14.5 h-14.5 shrink-0 rounded-pill bg-gold text-ink flex items-center justify-center shadow-fab transition-transform active:scale-95"
      >
        <PlusIcon />
      </Link>
    </nav>
  );
}
