"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { BackButton, PrimaryButton } from "@/components/ui";
import { capFaceGradient, capInkColor, capRingGradient } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";

const SLIDES = [
  {
    kicker: "01 · the game",
    title: "Shuss it. Log it.",
    body: "Beer-cap shuffleboard for the cellar, the garage and the alpine hut. Two duos, one mat, endless argument about who owes a sip.",
    glyphTop: "DAS",
    glyph: "MAT",
    cta: "Next",
  },
  {
    kicker: "02 · every cap counts",
    title: "Every cap on record.",
    body: "Log the result, tap in the mama hits, and Shussapp keeps the win rates, streaks and hit maps nobody could ever remember.",
    glyphTop: "MAMA",
    glyph: "×23",
    cta: "Next",
  },
  {
    kicker: "03 · the crew",
    title: "Bring the crew.",
    body: "Crews, events and tournaments in one place — plus a leaderboard that finally settles it. First game takes two minutes to log.",
    glyphTop: "CREW",
    glyph: "KG",
    cta: "Let's go",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const s = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  async function sendMagicLink() {
    if (!email) return;
    setSending(true);
    await signIn("resend", { email, callbackUrl: "/home" });
  }

  if (showAuth) {
    return (
      <div className="relative min-h-screen bg-gradient-bloom flex flex-col px-6.5 pt-8 pb-10 overflow-hidden">
        <div className="absolute inset-0 bg-ruled-texture pointer-events-none" />

        <BackButton onClick={() => setShowAuth(false)} className="relative" />

        <div className="relative flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <div className="font-display text-[44px] leading-[0.95] text-cream">
            SHUSS<span className="text-gold">APP</span>
          </div>
          <div className="font-heading font-semibold text-[15px] tracking-[2px] uppercase text-cream/55">
            Ready when you are
          </div>
        </div>

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

  return (
    <div className="relative min-h-screen bg-gradient-bloom flex flex-col px-6.5 pt-8 pb-10 overflow-hidden">
      <div className="absolute inset-0 bg-ruled-texture pointer-events-none" />

      <div className="relative flex items-center justify-between">
        <span className="font-display text-xl tracking-[0.04em] text-gold">SHUSSAPP</span>
        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="font-body text-body-sm text-cream/45"
        >
          Skip
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center">
        <div
          className="absolute w-67.5 h-67.5 rounded-pill pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(232,179,60,.18), transparent 66%)" }}
        />
        <div
          className="relative w-46.5 h-46.5 rounded-pill animate-bob"
          style={{
            background: capRingGradient("gold"),
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,.5), inset 0 -2px 3px rgba(0,0,0,.35), inset 0 2px 3px rgba(255,255,255,.12), 0 22px 46px rgba(0,0,0,.6)",
          }}
        >
          <div
            className="absolute inset-3.5 rounded-pill flex flex-col items-center justify-center gap-0.5"
            style={{
              background: capFaceGradient("gold"),
              boxShadow: "inset 0 1px 2px rgba(0,0,0,.45), inset 0 -1px 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.35)",
            }}
          >
            <span className="font-display text-base tracking-widest" style={{ color: capInkColor("gold") }}>
              {s.glyphTop}
            </span>
            <span className="font-display text-[40px] leading-[0.9]" style={{ color: capInkColor("gold") }}>
              {s.glyph}
            </span>
          </div>
        </div>
      </div>

      <div className="relative pb-2">
        <div className="font-mono font-medium text-[10px] tracking-[0.2em] uppercase text-gold/85">{s.kicker}</div>
        <div className="font-display text-[42px] leading-[1.02] text-cream mt-3.5 uppercase">{s.title}</div>
        <p className="font-body text-[14px] leading-[1.6] text-cream/60 mt-3.5 text-pretty">{s.body}</p>

        <div className="flex gap-1.5 pt-5.5">
          {SLIDES.map((slideItem, i) => (
            <button
              key={slideItem.title}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setSlide(i)}
              className={cn("h-1.75 rounded-pill transition-all", i === slide ? "w-6 bg-gold" : "w-1.75 bg-cream/20")}
            />
          ))}
        </div>
      </div>

      <div className="relative pt-5 flex flex-col gap-3">
        <PrimaryButton size="lg" onClick={() => (isLast ? setShowAuth(true) : setSlide((i) => i + 1))}>
          {s.cta}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="text-center font-body text-body-sm text-cream/40"
        >
          Already playing? Log in
        </button>
      </div>
    </div>
  );
}
