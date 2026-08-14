import { LinkButton } from "@/components/ui";

export default function CheckEmailPage() {
  return (
    <div className="relative min-h-screen bg-gradient-bloom flex flex-col items-center justify-center gap-5 px-8 text-center overflow-hidden">
      <div className="absolute inset-0 bg-ruled-texture pointer-events-none" />
      <div className="relative font-display text-[40px] leading-[0.95] text-cream">Check your inbox</div>
      <div className="relative font-body text-body text-cream/55 max-w-75">
        We sent you a magic link. Tap it on this device to finish signing in.
      </div>
      <LinkButton href="/onboarding" variant="outline" className="relative">
        Back to start
      </LinkButton>
    </div>
  );
}
