"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/ui";
import { joinCrew, type JoinCrewState } from "@/app/(app)/crews/actions";

const initialState: JoinCrewState = {};

export function JoinCrewForm({ initialError }: { initialError?: string }) {
  const [state, formAction, isPending] = useActionState(
    joinCrew,
    initialError ? { error: initialError } : initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      <input
        type="text"
        name="code"
        required
        autoFocus
        maxLength={6}
        placeholder="CREW CODE"
        className="h-14.5 rounded-lg bg-cream/8 px-4 font-display text-2xl tracking-[3px] text-center uppercase text-cream placeholder:text-cream/30 outline-none border-2 border-transparent focus:border-gold/40"
      />
      {state.error && <div className="text-center font-body text-body-sm text-red-pale">{state.error}</div>}
      <PrimaryButton type="submit" size="lg" disabled={isPending}>
        {isPending ? "Joining…" : "Join crew"}
      </PrimaryButton>
    </form>
  );
}
