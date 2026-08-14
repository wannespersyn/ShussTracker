"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { GroupIcon, HomeIcon, PlusIcon } from "../ui/icons";

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
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 w-16 pt-1.5",
        active ? "text-gold" : "text-cream/45",
      )}
    >
      {icon}
      <span className="font-heading font-bold text-[10.5px] tracking-[1.1px] uppercase">{label}</span>
    </Link>
  );
}

/** Fixed bottom tab bar for the signed-in app shell — hidden during the
 * immersive log-a-game wizard, which has its own full-bleed step flow and
 * primary CTA. */
export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/log")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div
        className="relative w-full max-w-md h-16 px-8 flex items-center justify-between bg-ink/95 backdrop-blur-sm border-t border-cream/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <NavItem href="/home" label="Home" active={pathname === "/home"} icon={<HomeIcon />} />

        <Link
          href="/log"
          aria-label="Log a game"
          className="absolute left-1/2 -translate-x-1/2 -top-7 w-14 h-14 rounded-pill bg-gold text-surface flex items-center justify-center shadow-fab transition-transform active:translate-y-1.5 active:shadow-none"
        >
          <PlusIcon />
        </Link>

        <NavItem
          href="/crews"
          label="Crews"
          active={pathname === "/crews" || pathname.startsWith("/crews/")}
          icon={<GroupIcon />}
        />
      </div>
    </nav>
  );
}
