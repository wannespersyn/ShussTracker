import { notFound } from "next/navigation";
import { requireSession } from "@/lib/db/authz";

/** Comma-separated allow-list in ADMIN_EMAILS. No list → no admin. */
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** 404s for everyone who isn't an admin, so the route doesn't advertise itself. */
export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminEmail(session.user.email)) notFound();
  return session;
}
