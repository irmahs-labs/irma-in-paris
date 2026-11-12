import * as z from "zod/mini";

import type { VelibReport, VelibStation } from "../src/lib/api";
import type { Box } from "../src/lib/map";
import { CENTRAL_PARIS, isInside } from "../src/lib/map";

/**
 * Vélib' Métropole's stations as the City of Paris republishes them, every
 * minute, on its open-data portal, which needs no key. Not Vélib's own GBFS
 * feed: the firewall in front of it turns the server away (403).
 */
const RECORDS =
  "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json";

/** The portal's "yes" and "no", in French. */
const YES = "OUI";

export const stationsAnswer = z.array(
  z.object({
    coordonnees_geo: z.object({ lat: z.number(), lon: z.number() }),
    ebike: z.number(),
    is_installed: z.string(),
    is_renting: z.string(),
    mechanical: z.number(),
    name: z.string(),
    numdocksavailable: z.number(),
    stationcode: z.string(),
  })
);

export type Stations = z.infer<typeof stationsAnswer>;

/** How many columns and rows the map is cut into: one station shows in each. */
const COLUMNS = 5;
const ROWS = 4;

/**
 * One open station per cell of a grid over the box, the one nearest the
 * cell's middle, so the pins spread over the whole map instead of crowding
 * where stations are thickest.
 */
export const spreadOut = (
  stations: readonly VelibStation[],
  box: Box = CENTRAL_PARIS
): VelibStation[] => {
  const width = (box.east - box.west) / COLUMNS;
  const height = (box.north - box.south) / ROWS;
  const picked: VelibStation[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const cell: Box = {
        east: box.west + (column + 1) * width,
        north: box.north - row * height,
        south: box.north - (row + 1) * height,
        west: box.west + column * width,
      };

      const lat = (cell.north + cell.south) / 2;
      const lon = (cell.west + cell.east) / 2;

      const distance = (station: VelibStation) =>
        (station.lat - lat) ** 2 + ((station.lon - lon) * 0.66) ** 2;

      const [nearest] = stations
        .filter((station) => isInside(cell, station.lat, station.lon))
        .toSorted((a, b) => distance(a) - distance(b));

      if (nearest) {
        picked.push(nearest);
      }
    }
  }

  return picked;
};

/** The open stations, as the transport screen shows them, one per cell of the map. */
export const toVelibReport = (
  stations: Stations,
  now: Date = new Date()
): VelibReport => ({
  stations: spreadOut(
    stations.flatMap((station) =>
      station.is_installed === YES && station.is_renting === YES
        ? [
            {
              docks: station.numdocksavailable,
              ebike: station.ebike,
              id: station.stationcode,
              lat: station.coordonnees_geo.lat,
              lon: station.coordonnees_geo.lon,
              mechanical: station.mechanical,
              name: station.name,
            },
          ]
        : []
    )
  ),
  updatedAt: now.toISOString(),
});

/** The portal's query: the stations inside the box, only the fields shown. */
export const recordsUrl = (box: Box = CENTRAL_PARIS) => {
  const query = new URLSearchParams({
    select:
      "stationcode,name,is_installed,is_renting,numdocksavailable,mechanical,ebike,coordonnees_geo",
    where: `in_bbox(coordonnees_geo, ${box.south}, ${box.west}, ${box.north}, ${box.east})`,
  });

  return `${RECORDS}?${query}`;
};

export const fetchVelib = async (
  fetcher: typeof fetch = fetch
): Promise<VelibReport> => {
  const url = recordsUrl();
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });

  if (!response.ok) {
    // The start of the body says who refused: the portal itself, or the
    // firewall in front of it.
    const body = await response.text();

    throw new Error(
      `Vélib' answered ${response.status} for ${url}: ${body.slice(0, 300)}`
    );
  }

  return toVelibReport(stationsAnswer.parse(await response.json()));
};
