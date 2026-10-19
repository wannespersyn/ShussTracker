"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { claimGuestAction, type ClaimGuestState } from "@/app/(app)/claim/actions";

const initialState: ClaimGuestState = {};

export function ClaimGuestForm({ defaultCode }: Readonly<{ defaultCode?: string }>) {
  const [state, formAction, isPending] = useActionState(claimGuestAction, initialState);
  const { t } = useT();

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      <input
        type="text"
        name="code"
        required
        autoFocus
        defaultValue={defaultCode}
        maxLength={6}
        placeholder={t.claim.codePh}
        className="h-16 rounded-lg bg-surface-panel border border-line px-4 font-display text-3xl tracking-[4px] text-center uppercase text-cream placeholder:text-cream/30 outline-none border-2 border-transparent focus:border-gold/40"
      />
      {state.error && <div className="text-center font-body text-body-sm text-red-pale">{state.error}</div>}
      <PrimaryButton type="submit" size="lg" disabled={isPending}>
        {isPending ? t.claim.claiming : t.claim.cta}
      </PrimaryButton>
    </form>
  );
}
