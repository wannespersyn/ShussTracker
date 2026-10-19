/** Instant skeleton while a screen's data loads — shown on every in-app
 * navigation so a tap always responds immediately. */
export default function Loading() {
  return (
    <div className="min-h-screen bg-surface flex flex-col gap-3.5 px-5 pt-4.5 pb-30 w-full max-w-xl mx-auto" aria-busy="true" aria-label="Loading">
      <div className="h-11 flex items-center justify-between">
        <div className="h-7 w-36 rounded-sm bg-surface-deep motion-safe:animate-pulse" />
        <div className="h-11 w-11 rounded-pill bg-surface-deep motion-safe:animate-pulse" />
      </div>
      <div className="h-48 rounded-[20px] bg-surface-deep border border-line motion-safe:animate-pulse" />
      <div className="h-14 rounded-lg bg-surface-deep motion-safe:animate-pulse" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-md bg-surface-deep border border-line motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
