"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/ui";
import { claimGuestAction, type ClaimGuestState } from "@/app/(app)/claim/actions";

const initialState: ClaimGuestState = {};

export function ClaimGuestForm() {
  const [state, formAction, isPending] = useActionState(claimGuestAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      <input
        type="text"
        name="code"
        required
        autoFocus
        maxLength={6}
        placeholder="CLAIM CODE"
        className="h-16 rounded-lg bg-cream/8 px-4 font-display text-3xl tracking-[4px] text-center uppercase text-cream placeholder:text-cream/30 outline-none border-2 border-transparent focus:border-gold/40"
      />
      {state.error && <div className="text-center font-body text-body-sm text-red-pale">{state.error}</div>}
      <PrimaryButton type="submit" size="lg" disabled={isPending}>
        {isPending ? "Claiming…" : "Claim my stats"}
      </PrimaryButton>
    </form>
  );
}
