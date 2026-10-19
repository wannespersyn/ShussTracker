/**
 * AuthProvider
 *
 * Holds the signed-in state for the whole app: restores the token from the
 * keychain on start, loads /me, and exposes sign-in (Apple, dev login),
 * sign-out and refresh. A 401 from any API call signs the user out.
 *
 * Exports: AuthProvider, useAuth
 * Notes: Google sign-in needs a development build (native module); it is
 * wired in once the Google client ids exist.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "@/api/client";
import type { Me, SignInResponse } from "@/api/types";
import { storedPushToken } from "@/lib/push";

type Status = "loading" | "signedOut" | "signedIn";
type Ctx = {
  status: Status;
  me: Me | null;
  signInWithApple: (identityToken: string, fullName: string | null) => Promise<void>;
  signInDev: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);

  const clear = useCallback(async () => {
    await tokenStore.clear();
    setMe(null);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    (async () => {
      if (!(await tokenStore.load())) return setStatus("signedOut");
      try {
        setMe(await api<Me>("/me"));
        setStatus("signedIn");
      } catch (e) {
        // Offline at launch: keep the session, screens show a retry.
        if ((e as { status?: number }).status === 0) setStatus("signedIn");
        else await clear();
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const finish = useCallback(async (res: SignInResponse) => {
    await tokenStore.save(res.token);
    setMe({ user: res.user, crews: res.crews });
    setStatus("signedIn");
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      status,
      me,
      signInWithApple: async (identityToken, fullName) =>
        finish(await api<SignInResponse>("/auth/apple", { method: "POST", body: { identityToken, fullName } })),
      signInDev: async (email) => finish(await api<SignInResponse>("/auth/dev", { method: "POST", body: { email } })),
      signOut: async () => {
        const pushToken = await storedPushToken();
        await api("/auth/logout", { method: "POST", body: pushToken ? { pushToken } : {} }).catch(() => {});
        await clear();
      },
      refreshMe: async () => setMe(await api<Me>("/me")),
    }),
    [status, me, finish, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>");
  return ctx;
}
