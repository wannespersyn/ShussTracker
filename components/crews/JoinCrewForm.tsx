"use client";

import { useActionState } from "react";
import { joinCrew, type JoinCrewState } from "@/app/(app)/crews/actions";
import { useT } from "@/lib/i18n/client";

const initialState: JoinCrewState = {};

export function JoinCrewForm({ initialError, defaultCode }: Readonly<{ initialError?: string; defaultCode?: string }>) {
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(joinCrew, initialError ? { error: initialError } : initialState);

  return (
    <form action={formAction} className="flex-1 flex flex-col gap-3.5">
      <label htmlFor="code" className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">
        {t.join.code}
      </label>
      <input
        id="code"
        type="text"
        name="code"
        required
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        defaultValue={defaultCode}
        maxLength={6}
        placeholder={t.join.codePh}
        className="h-[76px] rounded-[16px] border-2 border-gold bg-surface-deep text-center font-display font-extrabold text-[40px] tracking-[0.18em] uppercase text-cream placeholder:text-cream/25 outline-none"
      />
      {state.error && <div className="text-center font-body text-sm text-red-pale">{state.error}</div>}
      <p className="flex items-start gap-2.5 px-3.5 py-3 rounded-[14px] bg-surface-deep border border-line font-body text-[13px] leading-[1.4]! text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-px" aria-hidden="true">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
        </svg>
        {t.join.scanHint}
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.06em] uppercase disabled:opacity-60"
      >
        {isPending ? t.join.joining : t.join.cta}
      </button>
    </form>
  );
}
