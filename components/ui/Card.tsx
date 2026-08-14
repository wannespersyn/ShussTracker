import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** default: generic content wrapper. gold/red: tinted-state cards
   * (best-duo, risk-zone). hero: gradient hero card (win-rate, replay
   * header). flat: subtler fill, no border (history rows, feed items). */
  variant?: "default" | "gold" | "red" | "hero" | "flat";
  children: ReactNode;
};

export function Card({ variant = "default", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-4",
        variant === "default" && "bg-cream/5 border border-cream/10",
        variant === "gold" && "bg-gold/10 border border-gold/30",
        variant === "red" && "bg-red/12 border border-red/32",
        variant === "hero" && "bg-gradient-hero border border-gold/28",
        variant === "flat" && "bg-cream/4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
