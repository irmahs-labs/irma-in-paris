import * as z from "zod/mini";

import type { VelibReport, VelibStation } from "../src/lib/api";
import type { Box } from "../src/lib/map";
import { CENTRAL_PARIS, isInside } from "../src/lib/map";

/** Vélib' Métropole's open data (GBFS), which needs no key. */
const FEED =
  "https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole";

const id = z.union([z.number(), z.string()]);

export const informationAnswer = z.object({
  data: z.object({
    stations: z.array(
      z.object({
        lat: z.number(),
        lon: z.number(),
        name: z.string(),
        station_id: id,
      })
    ),
  }),
});

export const statusAnswer = z.object({
  data: z.object({
    stations: z.array(
      z.object({
        is_installed: z.number(),
        is_renting: z.number(),
        num_bikes_available_types: z.optional(
          z.array(z.record(z.string(), z.number()))
        ),
        num_docks_available: z.number(),
        station_id: id,
      })
    ),
  }),
});

/** How many columns and rows the map is cut into: one station shows in each. */
const COLUMNS = 4;
const ROWS = 3;

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

const countOf = (
  types: Record<string, number>[] | undefined,
  kind: "mechanical" | "ebike"
) => types?.reduce((sum, type) => sum + (type[kind] ?? 0), 0) ?? 0;

/** The two GBFS files, joined by station, as the transport screen shows them. */
export type Information = z.infer<typeof informationAnswer>;

export type Status = z.infer<typeof statusAnswer>;

export const toVelibReport = (
  information: Information,
  status: Status,
  now: Date = new Date()
): VelibReport => {
  const places = new Map(
    information.data.stations.map((station) => [
      String(station.station_id),
      station,
    ])
  );

  const stations = status.data.stations.flatMap((state) => {
    const place = places.get(String(state.station_id));

    if (!place || state.is_installed !== 1 || state.is_renting !== 1) {
      return [];
    }

    return [
      {
        docks: state.num_docks_available,
        ebike: countOf(state.num_bikes_available_types, "ebike"),
        id: String(state.station_id),
        lat: place.lat,
        lon: place.lon,
        mechanical: countOf(state.num_bikes_available_types, "mechanical"),
        name: place.name,
      },
    ];
  });

  return { stations: spreadOut(stations), updatedAt: now.toISOString() };
};

const getJson = async <T>(
  url: string,
  schema: z.ZodMiniType<T>,
  fetcher: typeof fetch
): Promise<T> => {
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });

  if (!response.ok) {
    throw new Error(`Vélib' answered ${response.status}`);
  }

  return schema.parse(await response.json());
};

export const fetchVelib = async (
  fetcher: typeof fetch = fetch
): Promise<VelibReport> => {
  const [information, status] = await Promise.all([
    getJson(`${FEED}/station_information.json`, informationAnswer, fetcher),
    getJson(`${FEED}/station_status.json`, statusAnswer, fetcher),
  ]);

  return toVelibReport(information, status);
};
