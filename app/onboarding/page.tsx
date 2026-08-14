"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { BackButton, PrimaryButton } from "@/components/ui";
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
        <div className="relative w-30 h-30">
          <div
            className="absolute left-1 top-3.5 w-24 h-24 opacity-35"
            style={{
              background:
                "repeating-conic-gradient(from 0deg, rgba(246,239,221,.4) 0deg 8.571deg, rgba(246,239,221,.7) 8.571deg 17.143deg)",
              clipPath: capCrownClipPath,
              transform: "rotate(-14deg)",
            }}
          />
          <div
            className="absolute left-4.5 top-0 w-25.5 h-25.5 shadow-[0_10px_16px_rgba(0,0,0,0.55)]"
            style={{ background: capRingGradient("gold"), clipPath: capCrownClipPath }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-pill bg-cream flex items-center justify-center font-display text-[32px] text-surface tracking-[-1px]">
              S
            </div>
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-[60px] leading-[0.86] tracking-[1px] text-cream">
            SHUSS<span className="text-gold">APP</span>
          </div>
          <div className="inline-block mt-2 px-3.5 py-1.5 rounded-pill border-2 border-gold/50 font-heading font-bold text-[13.5px] tracking-[2.6px] uppercase text-gold">
            Est. somebody&apos;s garden
          </div>
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
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setShowEmailForm(false)} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@crew.com"
                autoFocus
                className="flex-1 h-14.5 rounded-lg bg-cream/8 px-4 font-body text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
              />
            </div>
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

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/home" })}
          className="mt-0.5 h-13 rounded-md bg-cream/8 flex items-center justify-center font-body font-semibold text-base text-cream"
        >
          Continue with Google
        </button>

        <div className="mt-2 text-center font-body text-[12.5px] leading-[1.5] text-cream/38">
          Fan-built, unofficial, no lawyers involved.
          <br />
          We only track caps, never your tab.
        </div>
      </div>
    </div>
  );
}
