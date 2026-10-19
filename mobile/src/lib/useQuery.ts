/**
 * useQuery
 *
 * Minimal data hook for GET endpoints: loads on mount and whenever the path
 * changes, keeps showing the previous data while reloading, and exposes
 * `reload` for pull-to-refresh. Pass `null` as path to skip loading;
 * changing `version` refetches the same path.
 */
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/api/client";

type Result<T> = { path: string; data: T | null; error: ApiError | null };

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, "unknown", String(e)));

export function useQuery<T>(path: string | null, version = 0) {
  const [result, setResult] = useState<Result<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path).then(
      (data) => live && setResult({ path, data, error: null }),
      (e) => live && setResult((prev) => ({ path, data: prev?.path === path ? prev.data : null, error: toApiError(e) })),
    );
    return () => {
      live = false;
    };
  }, [path, version]);

  const reload = useCallback(async () => {
    if (!path) return;
    setRefreshing(true);
    try {
      const data = await api<T>(path);
      setResult({ path, data, error: null });
    } catch (e) {
      setResult((prev) => ({ path, data: prev?.path === path ? prev.data : null, error: toApiError(e) }));
    } finally {
      setRefreshing(false);
    }
  }, [path]);

  const current = result?.path === path ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !!path && !current, refreshing, reload };
}
