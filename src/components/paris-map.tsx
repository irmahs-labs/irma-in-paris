import type { CSSProperties, ReactNode } from "react";

import type { Box } from "../lib/map";
import { SEINE, aspectOf, placeOnMap } from "../lib/map";

interface ParisMapProps {
  box: Box;
  /** The pins, each placed with `pinStyle`. */
  children: ReactNode;
  /**
   * The map's shortest height on a wide screen, so a wide window keeps room
   * for its pins. On a phone the map keeps its shape, or it would push the
   * page wider than the screen.
   */
  minHeight?: number;
}

/** Where a pin goes on the map: its point, at the bottom of the pin. */
export const pinStyle = (box: Box, lat: number, lon: number) => {
  const { x, y } = placeOnMap(box, lat, lon);

  return { left: `${x}%`, top: `${y}%` };
};

/**
 * A plain map of Paris: the Seine, outlined, on the panel colour, and pins
 * over it. It keeps the box's shape on the ground unless `minHeight` makes
 * it taller; the river then stretches with the pins, since both are placed
 * as a share of the map's width and height.
 */
export const ParisMap = ({ box, children, minHeight = 0 }: ParisMapProps) => {
  const aspect = aspectOf(box);
  const width = 1000;
  const height = width / aspect;

  const river = SEINE.map(([lat, lon]) => {
    const { x, y } = placeOnMap(box, lat, lon);

    return `${((x / 100) * width).toFixed(1)},${((y / 100) * height).toFixed(1)}`;
  }).join(" ");

  // SAFETY: React passes custom properties through; CSSProperties just does not list them
  const style = {
    "--map-min": `${minHeight}px`,
    aspectRatio: String(aspect),
  } as CSSProperties;

  return (
    <div className="map" style={style}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <polyline
          className="map__river map__river--edge"
          points={river}
          strokeWidth="17"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          className="map__river map__river--water"
          points={river}
          strokeWidth="14"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="map__label">la seine</span>
      {children}
    </div>
  );
};
