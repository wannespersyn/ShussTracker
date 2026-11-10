/**
 * Elo constants (shared)
 *
 * Re-exports the website's lib/elo.ts so shared game logic imported via
 * @shared (which asks for "@/lib/elo") resolves inside the app too.
 */
export * from "../../../lib/elo";
