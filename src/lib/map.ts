/**
 * The two maps the app draws: central Paris for the Vélib' stations, and
 * the whole city for the places. A box is a stretch of latitude and
 * longitude; points inside it are placed on the map as percentages, so the
 * pins sit right at any size.
 */
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

/** Inside the Périphérique, and a little past it. */
export const ALL_PARIS: Box = {
  east: 2.47,
  north: 48.902,
  south: 48.815,
  west: 2.224,
};

const RADIANS = Math.PI / 180;

/**
 * How much wider than tall the box is on the ground: a degree of longitude
 * is shorter than a degree of latitude this far north.
 */
export const aspectOf = (box: Box): number => {
  const middle = ((box.north + box.south) / 2) * RADIANS;

  return ((box.east - box.west) * Math.cos(middle)) / (box.north - box.south);
};

export const isInside = (box: Box, lat: number, lon: number): boolean =>
  lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east;

/** Where a point sits on the map, from its top-left corner, in percent. */
export interface MapPoint {
  x: number;
  y: number;
}

export const placeOnMap = (box: Box, lat: number, lon: number): MapPoint => ({
  x: ((lon - box.west) / (box.east - box.west)) * 100,
  y: ((box.north - lat) / (box.north - box.south)) * 100,
});

/**
 * The Seine through Paris, west to east, one point by each of its main
 * bridges: enough to draw it, not to sail by.
 */
export const SEINE: readonly (readonly [number, number])[] = [
  [48.8335, 2.2565],
  [48.8395, 2.2675],
  [48.8467, 2.2755],
  [48.851, 2.281],
  [48.8556, 2.287],
  [48.86, 2.293],
  [48.8635, 2.301],
  [48.8643, 2.311],
  [48.8637, 2.32],
  [48.8605, 2.3285],
  [48.8583, 2.3375],
  [48.857, 2.3415],
  [48.8535, 2.347],
  [48.852, 2.353],
  [48.85, 2.3605],
  [48.8455, 2.365],
  [48.8405, 2.3735],
  [48.8348, 2.381],
  [48.829, 2.389],
  [48.8235, 2.399],
];
