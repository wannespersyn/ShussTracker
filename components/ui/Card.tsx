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
        variant === "default" && "bg-surface-deep border border-line",
        variant === "gold" && "bg-surface-raised border border-gold/40",
        variant === "red" && "bg-red/10 border border-red/35",
        variant === "hero" && "bg-surface-deep border border-line",
        variant === "flat" && "bg-surface-deep",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
