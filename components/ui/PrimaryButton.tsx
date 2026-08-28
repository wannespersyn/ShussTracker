import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** gold: the signature chunky CTA. inverted: dark button on a gold
   * surface (paywall "GO PRO", gold recap slide). outline: solid 2px
   * border, same Anton CTA type (onboarding "I'VE GOT A CREW CODE").
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
    "rounded-cta transition-transform duration-100 inline-flex items-center justify-center active:scale-[0.98]",
    "disabled:opacity-40 disabled:pointer-events-none",
    size === "lg" ? "h-13.5 px-7 text-xl" : "h-12.5 px-6 text-lg",
    variant !== "ghost" && "font-display uppercase tracking-[1.2px]",
    variant === "gold" && cn("bg-gold text-ink", size === "lg" ? "shadow-cta-lg" : "shadow-cta"),
    variant === "inverted" && "bg-ink text-cream shadow-cta-inverted",
    variant === "outline" && "bg-transparent text-cream border-2 border-cream/28",
    variant === "ghost" &&
      "bg-transparent text-cream/65 border-2 border-dashed border-cream/22 font-heading font-bold text-base tracking-[1.6px] uppercase",
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
