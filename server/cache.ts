/**
 * Keeps each answer for `ttlMs`, so a page full of visitors asks an outside
 * API once per window instead of once each. Visitors asking at the same time
 * share one request. A failed request is not kept: the next visitor tries
 * again, and while the last good answer is less than `staleMs` old it is
 * served instead of the error.
 */
export const createCache = <T>({
  ttlMs,
  staleMs = ttlMs * 10,
  now = Date.now,
}: {
  ttlMs: number;
  staleMs?: number;
  now?: () => number;
}) => {
  const entries = new Map<string, { at: number; value: T }>();
  const pending = new Map<string, Promise<T>>();

  const refresh = async (key: string, load: () => Promise<T>): Promise<T> => {
    const entry = entries.get(key);

    try {
      const value = await load();

      entries.set(key, { at: now(), value });

      return value;
    } catch (error) {
      if (entry && now() - entry.at < staleMs) {
        return entry.value;
      }

      throw error;
    } finally {
      pending.delete(key);
    }
  };

  return (key: string, load: () => Promise<T>): Promise<T> => {
    const entry = entries.get(key);

    if (entry && now() - entry.at < ttlMs) {
      return Promise.resolve(entry.value);
    }

    const request = pending.get(key) ?? refresh(key, load);

    pending.set(key, request);

    return request;
  };
};
