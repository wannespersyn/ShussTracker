import Link from "next/link";
import { cn } from "@/lib/cn";
import { ArrowLeftIcon } from "./icons";

const backButtonClasses = "w-10.5 h-10.5 rounded-md bg-cream/10 flex items-center justify-center text-cream shrink-0";

type BackButtonProps = { className?: string } & (
  | { href: string; onClick?: never }
  | { href?: never; onClick: () => void }
);

/** Consistent back affordance for wizard steps and detail screens — a real
 * `<Link>` when going to a fixed route, or a `<button>` when the caller
 * manages its own step state. */
export function BackButton({ href, onClick, className }: BackButtonProps) {
  if (href) {
    return (
      <Link href={href} aria-label="Back" className={cn(backButtonClasses, className)}>
        <ArrowLeftIcon className="w-5 h-5" />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label="Back" className={cn(backButtonClasses, className)}>
      <ArrowLeftIcon className="w-5 h-5" />
    </button>
  );
}
