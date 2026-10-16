/** Crew Pro status. Payments aren't live yet, so nothing is gated on this —
 * it only drives the "Founding Crew" badge and will gate Pro features once
 * billing ships. */
export type PlanInfo = { plan: "free" | "founding" | "pro"; proUntil: Date | null };

export function isPro(info: PlanInfo, now: Date = new Date()): boolean {
  if (info.plan === "free") return false;
  return !info.proUntil || info.proUntil.getTime() > now.getTime();
}
