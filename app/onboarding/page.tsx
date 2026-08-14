"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { PrimaryButton } from "@/components/ui";
import { capCrownClipPath, capRingGradient } from "@/lib/theme/tokens";

export default function OnboardingPage() {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function sendMagicLink() {
    if (!email) return;
    setSending(true);
    await signIn("resend", { email, callbackUrl: "/home" });
  }

  return (
    <div className="relative min-h-screen bg-gradient-bloom flex flex-col px-6.5 pt-19.5 pb-10 overflow-hidden">
      <div className="absolute inset-0 bg-ruled-texture pointer-events-none" />

      <div className="relative flex flex-col items-center gap-4.5 mt-6.5">
        <div
          className="relative w-26 h-26 shadow-[0_12px_34px_rgba(0,0,0,0.5)]"
          style={{ background: capRingGradient("gold"), clipPath: capCrownClipPath }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-19 h-19 rounded-pill bg-cream flex items-center justify-center font-display text-[38px] text-surface tracking-[-1px]">
            S
          </div>
        </div>
        <div className="font-display text-[60px] leading-[0.86] tracking-[1px] text-center text-cream">
          SHUSS<span className="text-gold">APP</span>
        </div>
        <div className="font-heading font-semibold text-[19px] tracking-[2.4px] uppercase text-cream/62 text-center">
          Flick caps. Talk trash.
          <br />
          Keep the receipts.
        </div>
      </div>

      <div className="relative flex gap-2.5 justify-center mt-9">
        <span className="px-3.25 py-1.75 rounded-pill border border-gold/40 font-heading font-semibold text-[13px] tracking-[1.4px] uppercase text-gold">
          4 or 8 players
        </span>
        <span className="px-3.25 py-1.75 rounded-pill border border-cream/22 font-heading font-semibold text-[13px] tracking-[1.4px] uppercase text-cream/60">
          Teams of 2
        </span>
      </div>

      <div className="flex-1" />

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
            <PrimaryButton size="lg" onClick={sendMagicLink} disabled={sending || !email}>
              {sending ? "Sending…" : "Send magic link"}
            </PrimaryButton>
          </>
        ) : (
          <PrimaryButton size="lg" onClick={() => setShowEmailForm(true)}>
            Start flicking
          </PrimaryButton>
        )}

        <PrimaryButton size="lg" variant="outline" onClick={() => router.push("/onboarding/join-crew")}>
          I&apos;ve got a crew code
        </PrimaryButton>

        <div className="flex items-center gap-2.5 mt-1.5">
          <div className="flex-1 h-px bg-cream/16" />
          <div className="font-heading text-[13px] tracking-[1.6px] uppercase text-cream/40">or</div>
          <div className="flex-1 h-px bg-cream/16" />
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/home" })}
          className="h-13.5 rounded-md bg-cream/8 flex items-center justify-center font-body font-semibold text-base text-cream"
        >
          Continue with Google
        </button>

        <div className="mt-3 text-center font-body text-[12.5px] leading-[1.5] text-cream/38">
          Fan-built, unofficial, no lawyers involved.
          <br />
          We only track caps, never your tab.
        </div>
      </div>
    </div>
  );
}
