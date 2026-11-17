/**
 * Retry for fire-and-forget saves
 *
 * The camera beta saves checks, corrections and labels in the background
 * (a server action the UI doesn't wait for). On a bad connection in a
 * kot a single attempt is easily lost, so `retry` tries a few times with
 * a growing pause and only then calls `onFail`, so the screen can say a
 * save didn't make it instead of dropping it silently.
 */

/** Pauses before each next attempt (ms): 4 attempts in ~10 s. */
const PAUSES = [1000, 3000, 6000];

export function retry<T>(fn: () => Promise<T>, onFail?: (err: unknown) => void): void {
  let attempt = 0;
  const run = () => {
    fn().catch((err) => {
      const pause = PAUSES[attempt++];
      if (pause === undefined) onFail?.(err);
      else window.setTimeout(run, pause);
    });
  };
  run();
}
