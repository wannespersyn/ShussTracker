"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { BackButton, PrimaryButton } from "@/components/ui";

export default function JoinCrewOnboardingPage() {
  const [code, setCode] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const trimmedCode = code.trim().toUpperCase();
  const canContinue = trimmedCode.length > 0;
  const callbackUrl = `/crews/join?code=${encodeURIComponent(trimmedCode)}`;

  async function sendMagicLink() {
    if (!email || !canContinue) return;
    setSending(true);
    await signIn("resend", { email, callbackUrl });
  }

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
        {showEmailForm ? (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@crew.com"
              autoFocus
              className="h-14.5 rounded-lg bg-cream/8 px-4 font-body text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
            />
            <PrimaryButton size="lg" onClick={sendMagicLink} disabled={sending || !email || !canContinue}>
              {sending ? "Sending…" : "Send magic link"}
            </PrimaryButton>
          </>
        ) : (
          <PrimaryButton size="lg" disabled={!canContinue} onClick={() => setShowEmailForm(true)}>
            Continue with email
          </PrimaryButton>
        )}

        <div className="flex items-center gap-2.5 mt-1.5">
          <div className="flex-1 h-px bg-cream/16" />
          <div className="font-heading text-[13px] tracking-[1.6px] uppercase text-cream/40">or</div>
          <div className="flex-1 h-px bg-cream/16" />
        </div>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => signIn("google", { callbackUrl })}
          className="h-13.5 rounded-md bg-cream/8 flex items-center justify-center font-body font-semibold text-base text-cream disabled:opacity-40"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
