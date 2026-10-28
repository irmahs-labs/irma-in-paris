import {
  LngLatBounds,
  Map as MapLibre,
  Marker,
  NavigationControl,
  addProtocol,
  setWorkerUrl,
} from "maplibre-gl";
// MapLibre finds its worker beside its own file, which a bundler moves; the
// worker is one file with no imports, so Vite ships it as it is.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import "maplibre-gl/dist/maplibre-gl.css";
import { createPortal } from "react-dom";

import { styleFor } from "../lib/map-style";
import { useTheme } from "../lib/theme";

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  /** The pin itself, a real button: React draws it, MapLibre places it. */
  node: ReactNode;
}

interface ParisMapProps {
  markers: readonly MapMarker[];
  /** The id of the marker the visitor picked, brought into view when it changes. */
  focus?: string;
  /** "Map of …", for screen readers. */
  label: string;
}

// Lets MapLibre read pmtiles:// sources, once for the whole page.
addProtocol("pmtiles", new Protocol().tile);

setWorkerUrl(workerUrl);

const PARIS: [number, number] = [2.3488, 48.8534];

/**
 * A real map of Paris: Protomaps' basemap, from the app's own PMTiles file
 * (OpenStreetMap data), drawn by MapLibre in Light or Dark Matcha, with the
 * pins as React buttons on top. Nothing is asked of any other site.
 */
const ParisMap = ({ markers, focus, label }: ParisMapProps) => {
  const theme = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibre | null>(null);
  // One element per marker, kept across renders so React can portal into it.
  const [elements] = useState(() => new Map<string, HTMLElement>());
  const placed = useRef(new Map<string, Marker>());
  const fitted = useRef(false);

  const elementFor = (id: string) => {
    let element = elements.get(id);

    if (!element) {
      element = document.createElement("div");
      elements.set(id, element);
    }

    return element;
  };

  useEffect(() => {
    if (!box.current) {
      return;
    }

    const created = new MapLibre({
      attributionControl: { compact: true },
      center: PARIS,
      container: box.current,
      // A page scrolls past the map; two fingers, or Ctrl and the wheel, move it.
      cooperativeGestures: true,
      maxZoom: 18,
      minZoom: 10,
      style: styleFor(theme, window.location.origin),
      zoom: 11.5,
    });

    created.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right"
    );
    setMap(created);

    return () => {
      created.remove();
      setMap(null);
    };
    // The theme is applied below without rebuilding the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map?.setStyle(styleFor(theme, window.location.origin));
  }, [map, theme]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const ids = new Set(markers.map((marker) => marker.id));

    for (const [id, marker] of placed.current) {
      if (!ids.has(id)) {
        marker.remove();
        placed.current.delete(id);
        elements.delete(id);
      }
    }

    for (const marker of markers) {
      const known = placed.current.get(marker.id);

      if (known) {
        known.setLngLat([marker.lon, marker.lat]);
      } else {
        placed.current.set(
          marker.id,
          new Marker({ anchor: "bottom", element: elementFor(marker.id) })
            .setLngLat([marker.lon, marker.lat])
            .addTo(map)
        );
      }
    }

    // The first time there are pins, frame them all.
    if (!fitted.current && markers.length > 0) {
      const bounds = new LngLatBounds();

      for (const marker of markers) {
        bounds.extend([marker.lon, marker.lat]);
      }

      map.fitBounds(bounds, { animate: false, maxZoom: 15, padding: 48 });
      fitted.current = true;
    }
  });

  useEffect(() => {
    const target = markers.find((marker) => marker.id === focus);

    if (map && target) {
      map.easeTo({ center: [target.lon, target.lat], duration: 400 });
    }
    // Only when the focus changes, not on every refresh of the pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus]);

  return (
    <div className="map" role="region" aria-label={label}>
      <div ref={box} className="map__canvas" />
      {markers.map((marker) =>
        createPortal(marker.node, elementFor(marker.id), marker.id)
      )}
    </div>
  );
};

export default ParisMap;
