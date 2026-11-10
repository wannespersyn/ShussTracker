/**
 * API client
 *
 * Thin fetch wrapper for the Shussapp backend (/api/v1): adds the bearer
 * token and Accept-Language, parses JSON and turns error bodies into
 * ApiError. The token lives in the device keychain (expo-secure-store).
 *
 * Exports: api, upload, ApiError, apiUrl, authHeaders, tokenStore,
 *          setUnauthorizedHandler, setApiLocale
 * Env: EXPO_PUBLIC_API_URL (defaults to the production site).
 */
import * as SecureStore from "expo-secure-store";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://shussapp.vercel.app").replace(/\/$/, "");
export const apiUrl = (path: string) => `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;

const TOKEN_KEY = "shussapp.token";
let token: string | null = null;
let locale = "en";
let onUnauthorized: (() => void) | null = null;

export const tokenStore = {
  async load() {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token;
  },
  async save(value: string) {
    token = value;
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  },
  async clear() {
    token = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
  get: () => token,
};

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};
export const setApiLocale = (value: string) => {
  locale = value;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Headers for requests the app makes outside `api()`, e.g. <Image> sources. */
export const authHeaders = (): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});

type Options = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown };

/** Calls `/api/v1{path}`. Resolves with the parsed JSON (undefined for 204). */
export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/v1${path}`), {
      method,
      headers: {
        accept: "application/json",
        "accept-language": locale,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "network");
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, json?.error?.code ?? "unknown", json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

/** Multipart upload to `/api/v1{path}` (e.g. a game photo). */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/v1${path}`), {
      method: "POST",
      headers: { accept: "application/json", "accept-language": locale, ...authHeaders() },
      body: form,
    });
  } catch {
    throw new ApiError(0, "network", "network");
  }
  const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, json?.error?.code ?? "unknown", json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}
