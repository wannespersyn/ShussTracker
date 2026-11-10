/**
 * Selected crew
 *
 * Which of the user's crews the Home and Crew tabs show. Defaults to the
 * most active crew (first in /me); a switch is remembered on the device.
 * `version` / `invalidate` let screens refetch after a write.
 *
 * Exports: CrewProvider, useCrew
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/auth/AuthProvider";
import type { CrewSummary } from "@/api/types";

const KEY = "shussapp.crew";
type Ctx = {
  crews: CrewSummary[];
  crew: CrewSummary | null;
  setCrewId: (id: string) => void;
  /** Bumped after a write (e.g. a logged game) so crew screens refetch. */
  version: number;
  invalidate: () => void;
};
const CrewContext = createContext<Ctx | null>(null);

export function CrewProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [crewId, setCrewIdState] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then(setCrewIdState)
      .catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => {
    const crews = me?.crews ?? [];
    return {
      crews,
      crew: crews.find((c) => c.id === crewId) ?? crews[0] ?? null,
      setCrewId: (id) => {
        setCrewIdState(id);
        SecureStore.setItemAsync(KEY, id).catch(() => {});
      },
      version,
      invalidate: () => setVersion((v) => v + 1),
    };
  }, [me, crewId, version]);

  return <CrewContext.Provider value={value}>{children}</CrewContext.Provider>;
}

export function useCrew() {
  const ctx = useContext(CrewContext);
  if (!ctx) throw new Error("useCrew() must be used inside <CrewProvider>");
  return ctx;
}
