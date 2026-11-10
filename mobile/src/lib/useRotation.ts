/**
 * useRotation
 *
 * Loads one Americano / Mexicano (GET /api/v1/rotations/{id}) and refreshes
 * it every 15 s while it's running, so mats and standings follow what the
 * others log. Also returns a first-name lookup for its players.
 */
import { useEffect } from "react";
import type { RotationView } from "@/lib/db/rotations";
import { useCrew } from "@/lib/crew";
import { useQuery } from "@/lib/useQuery";

export type RotationResponse = {
  rotation: RotationView;
  crew: { id: string; name: string } | null;
  canManage: boolean;
  roster: { id: string; name: string; isGuest: boolean; elo: number; games: number }[];
};

const first = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] || "?";

export function useRotation(id: string | undefined, poll = true) {
  const { version } = useCrew();
  const q = useQuery<RotationResponse>(id ? `/rotations/${id}` : null, version);
  const live = q.data?.rotation.status !== "completed";
  const { reload } = q;
  useEffect(() => {
    if (!poll || !live) return;
    const t = setInterval(() => void reload(), 15000);
    return () => clearInterval(t);
  }, [poll, live, reload]);
  const names = new Map((q.data?.rotation.players ?? []).map((p) => [p.id, first(p.name)]));
  return { ...q, name: (pid: string) => names.get(pid) ?? "?" };
}
