import { useCallback, useState } from "react";

import type { Point } from "./geo";

/** Where asking the browser for the rider's position has got to. */
export type Locating =
  | { state: "idle" }
  | { state: "asking" }
  | { state: "found"; point: Point }
  | { state: "denied" }
  | { state: "unavailable" };

/**
 * The rider's position, asked of the browser only when they press the
 * button: the browser asks them first, and nothing is kept.
 */
export const useLocation = () => {
  const [locating, setLocating] = useState<Locating>({ state: "idle" });

  const ask = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocating({ state: "unavailable" });

      return;
    }

    setLocating({ state: "asking" });

    navigator.geolocation.getCurrentPosition(
      (position) =>
        setLocating({
          point: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          state: "found",
        }),
      (error) =>
        setLocating({
          state:
            error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        }),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 }
    );
  }, []);

  return { ask, locating };
};
