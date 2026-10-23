/**
 * Chwazi now lives inside the log wizard (Teams: shuffle, balance by Elo or
 * the beta finger picker). Old links and bookmarks land there.
 */
import { redirect } from "next/navigation";

export default async function ChwaziPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ crewId?: string; count?: string }> }>) {
  const { crewId } = await searchParams;
  redirect(crewId ? `/log?crewId=${crewId}` : "/log");
}
