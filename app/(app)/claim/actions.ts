"use server";

import { invalidateAllCrews } from "@/lib/cache-tags";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/db/authz";
import { findGuestByClaimCode, claimGuest } from "@/lib/db/guests";
import { getT } from "@/lib/i18n/server";

export type ClaimGuestState = { error?: string };

export async function claimGuestAction(_prev: ClaimGuestState, formData: FormData): Promise<ClaimGuestState> {
  const userId = await requireUserId();
  const code = String(formData.get("code") ?? "");

  const guest = await findGuestByClaimCode(code);
  const t = await getT();
  if (!guest) return { error: t.errors.claimNoMatch };
  if (guest.id === userId) return { error: t.errors.claimSelf };

  await claimGuest(guest.id, userId);
  invalidateAllCrews();
  redirect(`/players/${userId}`);
}
