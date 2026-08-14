import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** gold: the signature chunky CTA. inverted: dark button on a gold
   * surface (paywall "GO PRO", gold recap slide). outline: solid 2px
   * border, same Anton CTA type (onboarding "I'VE GOT A CREW CODE").
   * ghost: dashed border, Barlow Condensed label type, lowest emphasis
   * (log-a-game "Shuffle the duos"). */
  variant?: "gold" | "inverted" | "outline" | "ghost";
  /** md: 58px (most CTAs, 7px shadow lip). lg: 62px (onboarding hero
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
  const pressTranslate = size === "lg" ? "active:translate-y-[8px]" : "active:translate-y-[7px]";

  return cn(
    "rounded-lg transition-transform duration-100 inline-flex items-center justify-center",
    "disabled:opacity-40 disabled:pointer-events-none",
    size === "lg" ? "h-15.5 text-2xl" : "h-14.5 text-xl",
    variant !== "ghost" && "font-display uppercase tracking-[1.2px]",
    variant === "gold" &&
      cn("bg-gold text-surface", size === "lg" ? "shadow-cta-lg" : "shadow-cta", pressTranslate, "active:shadow-none"),
    variant === "inverted" &&
      cn("bg-surface text-cream shadow-cta-inverted", pressTranslate, "active:shadow-none"),
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
