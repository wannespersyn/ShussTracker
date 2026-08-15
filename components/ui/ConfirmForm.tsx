"use client";

import type { ReactNode } from "react";

/** A plain server-action `<form>` that asks for a native confirm() before
 * submitting — for destructive one-tap actions (delete crew, remove a
 * member) where a stray tap shouldn't be irreversible. */
export function ConfirmForm({
  action,
  confirmMessage,
  className,
  children,
}: Readonly<{
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
