"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { BackButton, PrimaryButton } from "@/components/ui";

export default function JoinCrewOnboardingPage() {
  const [code, setCode] = useState("");

  const trimmedCode = code.trim().toUpperCase();
  const canContinue = trimmedCode.length > 0;
  const callbackUrl = `/crews/join?code=${encodeURIComponent(trimmedCode)}`;

  return (
    <div className="relative min-h-screen bg-surface flex flex-col px-6 pt-6 pb-8 w-full max-w-md mx-auto">
      <BackButton href="/onboarding" className="relative" />

      <div className="relative flex flex-col items-center gap-3 mt-8 text-center">
        <div className="font-heading font-semibold text-[19px] tracking-[2.4px] uppercase text-cream/62">
          Got a crew code?
        </div>
        <div className="font-display font-extrabold text-[44px] leading-[0.95] text-cream uppercase">Punch it in</div>
      </div>

      <div className="relative flex-1 flex flex-col justify-center gap-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CREW CODE"
          maxLength={6}
          autoFocus
          className="h-18 rounded-lg bg-surface-panel border-2 border-gold px-4 font-display font-extrabold text-4xl tracking-[0.18em] text-center uppercase text-cream placeholder:text-cream/30 outline-none"
        />
      </div>

      <div className="relative flex flex-col gap-3">
        <PrimaryButton size="lg" disabled={!canContinue} onClick={() => signIn("google", { callbackUrl })}>
          Continue with Google
        </PrimaryButton>
      </div>
    </div>
  );
}
