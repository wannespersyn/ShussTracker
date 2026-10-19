import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: Readonly<{ title: string; updated: string; children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-surface text-cream font-body">
      <div className="max-w-[720px] mx-auto px-6 py-10 flex flex-col gap-6">
        <Link href="/" className="font-heading font-extrabold text-xl tracking-[0.06em] text-cream">
          SHUSSAPP
        </Link>
        <header className="flex flex-col gap-1">
          <h1 className="font-display font-extrabold text-5xl leading-none uppercase">{title}</h1>
          <span className="text-sm text-muted">{updated}</span>
        </header>
        <div className="flex flex-col gap-5 text-[15px] leading-[1.6]! text-soft [&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-xl [&_h2]:text-cream [&_h2]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_strong]:text-cream [&_a]:text-gold">
          {children}
        </div>
      </div>
    </div>
  );
}
