import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** gold: the signature chunky CTA. inverted: dark button on a gold
   * surface (paywall "GO PRO", gold recap slide). outline: solid 2px
   * border, same condensed CTA type (onboarding "I'VE GOT A CREW CODE").
   * ghost: dashed border, Barlow Condensed label type, lowest emphasis
   * (log-a-game "Shuffle the duos"). */
  variant?: "gold" | "inverted" | "outline" | "ghost";
  /** md: 50px (most CTAs, 7px shadow lip). lg: 54px (onboarding hero
   * CTA, 8px shadow lip). */
  size?: "md" | "lg";
  children: ReactNode;
};

/** Shared visual style for PrimaryButton and LinkButton — kept in one place
 * so a nav CTA that needs to be a real `<a>` (not a `<button>` nested
 * inside a `<Link>`) still matches exactly. */
export function primaryButtonClasses({
  variant = "gold",
  size = "md",
  className,
}: Pick<PrimaryButtonProps, "variant" | "size" | "className">) {
  return cn(
    "rounded-cta transition-transform duration-100 inline-flex items-center justify-center gap-2 active:scale-[0.98]",
    "disabled:opacity-40 disabled:pointer-events-none",
    size === "lg" ? "h-14.5 px-7 text-xl" : "h-13 px-6 text-lg",
    "font-heading font-extrabold uppercase tracking-[0.06em]",
    variant === "gold" && "bg-amber text-ink",
    variant === "inverted" && "bg-ink text-[#f3f1ea]",
    variant === "outline" && "bg-transparent text-cream border-2 border-cream/25",
    variant === "ghost" && "bg-transparent text-soft border border-dashed border-cream/25 font-bold text-base",
    className,
  );
}

export function PrimaryButton({
  variant = "gold",
  size = "md",
  type = "button",
  className,
  children,
  ...props
}: PrimaryButtonProps) {
  return (
    <button type={type} className={primaryButtonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}
