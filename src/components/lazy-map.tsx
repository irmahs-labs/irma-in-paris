import { Suspense, lazy } from "react";
import type { ComponentProps } from "react";

// MapLibre is the biggest thing the site loads, so only the screens with a
// map load it, and only once they open.
const ParisMap = lazy(() => import("./paris-map"));

export type { MapMarker } from "./paris-map";

export const LazyMap = (props: ComponentProps<typeof ParisMap>) => (
  <Suspense fallback={<div className="map" aria-busy="true" />}>
    <ParisMap {...props} />
  </Suspense>
);
