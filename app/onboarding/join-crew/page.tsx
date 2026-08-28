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
    <div className="relative min-h-screen bg-gradient-bloom flex flex-col px-6.5 pt-19.5 pb-10 overflow-hidden">
      <div className="absolute inset-0 bg-ruled-texture pointer-events-none" />

      <BackButton href="/onboarding" className="relative" />

      <div className="relative flex flex-col items-center gap-3 mt-8 text-center">
        <div className="font-heading font-semibold text-[19px] tracking-[2.4px] uppercase text-cream/62">
          Got a crew code?
        </div>
        <div className="font-display text-[40px] leading-[0.95] text-cream">Punch it in</div>
      </div>

      <div className="relative flex-1 flex flex-col justify-center gap-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CREW CODE"
          maxLength={6}
          autoFocus
          className="h-16 rounded-lg bg-cream/8 px-4 font-display text-3xl tracking-[4px] text-center uppercase text-cream placeholder:text-cream/30 outline-none border-2 border-transparent focus:border-gold/40"
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
