import { useCallback, useEffect, useState } from "react";

import type { ApiError } from "./api";

export interface Loaded<T> {
  data: T | undefined;
  /** The server's reason (`"no-prim-key"`, `"prim"`…), or "network". */
  error: string | undefined;
  reload: () => void;
}

/**
 * GETs `path` from this site's /api, again every `everyMs` while the page is
 * open, and again whenever `path` changes. The last good answer stays on
 * screen while a newer one loads, or when a later request fails.
 */
export const useApi = <T>(path: string | null, everyMs = 0): Loaded<T> => {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    setData(undefined);
    setError(undefined);
  }, [path]);

  useEffect(() => {
    if (!path) {
      return;
    }

    let alive = true;

    const load = async () => {
      try {
        const response = await fetch(path, { cache: "no-store" });
        const body: unknown = await response.json();

        if (!alive) {
          return;
        }

        if (response.ok) {
          // SAFETY: a 2xx from /api is what src/lib/api.ts describes for the path
          setData(body as T);
          setError(undefined);
        } else {
          // SAFETY: /api answers every refusal with an ApiError
          setError((body as ApiError).error ?? "server");
        }
      } catch {
        if (alive) {
          setError("network");
        }
      }
    };

    void load();

    const timer = everyMs > 0 ? setInterval(load, everyMs) : undefined;

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path, everyMs, tick]);

  return { data, error, reload };
};
