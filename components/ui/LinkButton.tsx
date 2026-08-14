import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { primaryButtonClasses } from "./PrimaryButton";

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: "gold" | "inverted" | "outline" | "ghost";
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
};

/** Same visual treatment as PrimaryButton, but a real `<a>` — for CTAs that
 * navigate. Avoids nesting a `<button>` inside `<Link>`'s `<a>`. */
export function LinkButton({ variant = "gold", size = "md", className, children, ...props }: LinkButtonProps) {
  return (
    <Link className={primaryButtonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
