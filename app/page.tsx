import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { LangSwitch } from "@/components/LangSwitch";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "Shussapp — the scoreboard for your cap-flicking crew",
  description: "Log games in seconds, follow your duo’s record, and settle once and for all who runs the crew.",
};

/** Public website. Signed-in users go straight to the app. */
export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/home");
  const t = await getT();
  const L = t.landing;

  const features: { title: string; body: string; icon: ReactNode }[] = [
    { title: L.f1, body: L.f1d, icon: <path d="M12 5v14M5 12h14" /> },
    {
      title: L.f2,
      body: L.f2d,
      icon: (
        <>
          <circle cx="8" cy="9" r="3.5" />
          <circle cx="16" cy="9" r="3.5" />
          <path d="M2 20c0-3 2.7-5 6-5 1.5 0 2.9.4 4 1.2 1.1-.8 2.5-1.2 4-1.2 3.3 0 6 2 6 5" />
        </>
      ),
    },
    { title: L.f3, body: L.f3d, icon: <path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 2 0-2-1-4 0-6z" /> },
    { title: L.f4, body: L.f4d, icon: <path d="M4 5h16v11H9l-5 4z" /> },
  ];
  const plans = [
    { name: L.free, price: "€0", per: L.forever, items: [L.p1a, L.p1b, L.p1c], hot: false },
    { name: L.pro, price: "€0", per: L.beta, items: [L.p2a, L.p2b, L.p2c], hot: true },
    { name: L.event, price: "—", per: L.soon, items: [L.p3a, L.p3b, L.p3c], hot: false },
  ];

  return (
    <div className="min-h-screen bg-surface text-cream font-body">
      <header className="max-w-[1200px] mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 text-cream">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeDasharray="3 2.2" />
            <circle cx="15" cy="15" r="8" fill="var(--color-gold)" />
          </svg>
          <span className="font-heading font-extrabold text-2xl tracking-[0.06em]">SHUSSAPP</span>
        </Link>
        <nav aria-label="Site" className="flex flex-wrap items-center gap-6 font-semibold text-[15px]">
          <a href="#features" className="text-soft hover:text-cream">
            {L.features}
          </a>
          <a href="#pricing" className="text-soft hover:text-cream">
            {L.pricing}
          </a>
          <Link href="/onboarding" className="text-soft hover:text-cream">
            {L.login}
          </Link>
          <LangSwitch size="sm" />
        </nav>
      </header>

      <section className="max-w-[1200px] mx-auto px-6 pt-12 pb-20 flex flex-wrap items-center gap-12">
        <div className="flex-[999_1_480px] min-w-0 flex flex-col gap-6">
          <span className="font-heading font-bold text-[15px] tracking-[0.18em] uppercase text-gold">{L.kicker}</span>
          <h1 className="font-display font-extrabold text-[clamp(56px,8vw,112px)] leading-[0.9]! tracking-[0.005em] uppercase">{L.h1}</h1>
          <p className="text-xl leading-[1.5]! text-soft max-w-[560px]">{L.lead}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/onboarding" className="h-14.5 px-5.5 rounded-[14px] bg-cream text-surface flex items-center gap-2.5 font-bold text-base">
              {L.start}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/onboarding/join-crew"
              className="h-14.5 px-5.5 rounded-[14px] bg-surface-panel border border-cream/18 text-cream flex items-center gap-2.5 font-bold text-base"
            >
              {L.code}
            </Link>
          </div>
          <span className="text-sm text-muted">{L.proof}</span>
        </div>
        <div aria-hidden="true" className="flex-[1_1_300px] flex justify-center">
          <div className="w-[300px] h-[600px] rounded-[44px] border-[10px] border-[#1d2224] bg-[#0b0d0c] px-4.5 py-6.5 flex flex-col gap-3 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <div className="bg-[#15191a] rounded-[16px] p-3.5 flex justify-between items-end">
              <span className="font-display font-extrabold text-[52px] leading-none text-[#ffb627]">#2</span>
              <span className="font-display font-bold text-[28px] text-[#f3f1ea]">1284</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[1, 1, 0, 1, 1].map((w, i) => (
                <div key={i} className={cn("h-6.5 rounded-[5px]", w ? "bg-[#ffb627]" : "bg-[#2a3033]")} />
              ))}
            </div>
            <div className="h-12 rounded-md bg-[#ffb627] text-[#111] flex items-center justify-center font-heading font-extrabold text-lg tracking-[0.06em]">
              LOG A GAME
            </div>
            <div className="h-11 rounded-[10px] bg-[#15191a]" />
            <div className="h-11 rounded-[10px] bg-[#15191a]" />
            <div className="h-11 rounded-[10px] bg-[#15191a]" />
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#121514] border-y border-cream/6">
        <div className="max-w-[1200px] mx-auto px-6 py-20 flex flex-col gap-10">
          <h2 className="font-display font-extrabold text-[clamp(40px,5vw,64px)] leading-[0.95]! uppercase">{L.featuresTitle}</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {features.map((f) => (
              <div key={f.title} className="bg-surface-deep border border-line rounded-[20px] p-6 flex flex-col gap-3">
                <span className="w-12 h-12 rounded-[14px] bg-amber text-ink flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    {f.icon}
                  </svg>
                </span>
                <span className="font-heading font-bold text-[26px]">{f.title}</span>
                <span className="text-base leading-[1.5]! text-soft">{f.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="max-w-[1200px] mx-auto px-6 py-20 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <h2 className="font-display font-extrabold text-[clamp(40px,5vw,64px)] leading-[0.95]! uppercase">{L.pricingTitle}</h2>
          <p className="text-lg text-soft">{L.pricingSub}</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {plans.map((p) => (
            <div
              key={p.name}
              className={cn("rounded-[20px] p-6 flex flex-col gap-4", p.hot ? "bg-surface-raised border-2 border-gold" : "bg-surface-deep border border-line")}
            >
              <span className={cn("font-heading font-bold text-base tracking-[0.14em] uppercase", p.hot ? "text-gold" : "text-muted")}>{p.name}</span>
              <span className="font-display font-extrabold text-[56px] leading-none">
                {p.price}
                <span className="text-xl font-semibold text-muted"> {p.per}</span>
              </span>
              <ul className="flex flex-col gap-2 text-base text-soft">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2.6" className="shrink-0 mt-0.5" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 pb-20">
        <div className="rounded-[28px] bg-amber text-ink px-8 py-12 flex flex-wrap items-center justify-between gap-6">
          <span className="font-display font-extrabold text-[clamp(36px,5vw,60px)] leading-[0.95]! uppercase">{L.ideaTitle}</span>
          <Link href="/feedback?type=idea" className="h-14 px-6.5 rounded-[14px] bg-[#111] text-[#f3f1ea] flex items-center font-bold text-base hover:text-[#f3f1ea]">
            {L.idea}
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-wrap justify-between gap-4 text-sm text-muted">
          <span>© 2026 Shussapp</span>
          <span>{L.legal}</span>
        </div>
      </footer>
    </div>
  );
}
