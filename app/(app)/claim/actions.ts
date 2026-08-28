"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/db/authz";
import { findGuestByClaimCode, claimGuest } from "@/lib/db/guests";

export type ClaimGuestState = { error?: string };

export async function claimGuestAction(_prev: ClaimGuestState, formData: FormData): Promise<ClaimGuestState> {
  const userId = await requireUserId();
  const code = String(formData.get("code") ?? "");

  const guest = await findGuestByClaimCode(code);
  if (!guest) return { error: "That code doesn't match anyone waiting to be claimed" };
  if (guest.id === userId) return { error: "That's already you" };

  await claimGuest(guest.id, userId);
  redirect(`/players/${userId}`);
}
