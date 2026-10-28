/** A stretch of latitude and longitude: where the Vélib' stations are picked from. */
export interface Box {
  west: number;
  east: number;
  south: number;
  north: number;
}

/** From the Louvre to Gare de Lyon, the Marais to the Latin Quarter. */
export const CENTRAL_PARIS: Box = {
  east: 2.385,
  north: 48.872,
  south: 48.842,
  west: 2.325,
};

export const isInside = (box: Box, lat: number, lon: number): boolean =>
  lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east;
