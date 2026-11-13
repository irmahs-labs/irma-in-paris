/** A place on the map. */
export interface Point {
  lat: number;
  lon: number;
}

const EARTH_METRES = 6_371_000;
const RADIANS = Math.PI / 180;

/** How far apart two points are, in metres: near enough for a city. */
export const metresBetween = (a: Point, b: Point) => {
  const middle = ((a.lat + b.lat) / 2) * RADIANS;
  const x = (b.lon - a.lon) * RADIANS * Math.cos(middle);
  const y = (b.lat - a.lat) * RADIANS;

  return Math.hypot(x, y) * EARTH_METRES;
};

/** The one nearest a point, or undefined when there are none. */
export const nearestTo = <T extends Point>(
  point: Point,
  places: readonly T[]
) => {
  let best: T | undefined;

  for (const place of places) {
    if (!best || metresBetween(point, place) < metresBetween(point, best)) {
      best = place;
    }
  }

  return best;
};
