/**
 * Lets each key act at most `max` times in any `windowMs`, counted in fixed
 * windows from its first act. Kept in memory: a restart forgets it, which
 * only ever lets someone through.
 */
export const createLimiter = ({
  max,
  windowMs,
  now = Date.now,
}: {
  max: number;
  windowMs: number;
  now?: () => number;
}) => {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    /** Counts an act by `key`; false when it is one too many. */
    allow: (key: string) => {
      const time = now();

      for (const [other, window] of windows) {
        if (time - window.start >= windowMs) {
          windows.delete(other);
        }
      }

      const window = windows.get(key) ?? { count: 0, start: time };

      window.count += 1;
      windows.set(key, window);

      return window.count <= max;
    },
  };
};
