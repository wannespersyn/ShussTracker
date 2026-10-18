"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/db/authz";
import { deleteAccount } from "@/lib/db/account";
import { invalidateAllCrews } from "@/lib/cache-tags";

export async function deleteAccountAction(formData: FormData) {
  const userId = await requireUserId();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return;
  await deleteAccount(userId);
  invalidateAllCrews();
  const jar = await cookies();
  for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) jar.delete(name);
  redirect("/?deleted=1");
}
