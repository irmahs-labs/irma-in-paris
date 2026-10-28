import * as z from "zod/mini";

import { TOWNS } from "../src/data/towns";
import type { PollenKind, RegionReport } from "../src/lib/api";

/**
 * The weather and the air now at every town on the Île-de-France map, from
 * Open-Meteo, which takes all the towns in one request: one for the weather,
 * one for the air quality and pollen (Copernicus CAMS, Europe only).
 */
const KINDS: readonly PollenKind[] = [
  "alder",
  "birch",
  "grass",
  "mugwort",
  "olive",
  "ragweed",
];

const where = () => ({
  latitude: TOWNS.map((town) => town.lat).join(","),
  longitude: TOWNS.map((town) => town.lon).join(","),
  timezone: "Europe/Paris",
});

const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams(
  {
    ...where(),
    current:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
  }
)}`;

const AIR_URL = `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams(
  {
    ...where(),
    current: ["european_aqi", ...KINDS.map((kind) => `${kind}_pollen`)].join(
      ","
    ),
  }
)}`;

export const weatherAnswer = z.array(
  z.object({
    current: z.object({
      relative_humidity_2m: z.number(),
      temperature_2m: z.number(),
      time: z.string(),
      wind_direction_10m: z.number(),
      wind_speed_10m: z.number(),
    }),
  })
);

const grains = z.optional(z.nullable(z.number()));

export const airAnswer = z.array(
  z.object({
    current: z.object({
      alder_pollen: grains,
      birch_pollen: grains,
      european_aqi: z.optional(z.nullable(z.number())),
      grass_pollen: grains,
      mugwort_pollen: grains,
      olive_pollen: grains,
      ragweed_pollen: grains,
    }),
  })
);

type Air = z.infer<typeof airAnswer>[number]["current"];

const roundOrNull = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Math.round(value);

/** The pollen there is most of, or null when Open-Meteo gave none of them. */
export const strongestPollen = (
  air: Air
): { grains: number; kind: PollenKind } | null => {
  let strongest: { grains: number; kind: PollenKind } | null = null;

  for (const kind of KINDS) {
    const count = air[`${kind}_pollen`] ?? null;

    if (count !== null && (strongest === null || count > strongest.grains)) {
      strongest = { grains: Math.round(count), kind };
    }
  }

  return strongest;
};

/**
 * Open-Meteo's answers, one entry per town in TOWNS' order, as the map shows
 * them. A town the air quality has no entry for shows without it.
 */
export const toRegion = (
  weather: z.infer<typeof weatherAnswer>,
  air: z.infer<typeof airAnswer> | null
): RegionReport => ({
  towns: TOWNS.flatMap((town, i) => {
    const now = weather[i]?.current;
    const airNow = air?.[i]?.current;

    if (!now) {
      return [];
    }

    return [
      {
        ...town,
        aqi: roundOrNull(airNow?.european_aqi),
        humidity: Math.round(now.relative_humidity_2m),
        pollen: airNow ? strongestPollen(airNow) : null,
        temp: Math.round(now.temperature_2m),
        windFrom: Math.round(now.wind_direction_10m),
        windKmh: Math.round(now.wind_speed_10m),
      },
    ];
  }),
  updatedAt: weather[0]?.current.time ?? "",
});

const getJson = async <T>(
  url: string,
  schema: z.ZodMiniType<T>,
  fetcher: typeof fetch
): Promise<T> => {
  const response = await fetcher(url, { signal: AbortSignal.timeout(10_000) });

  if (!response.ok) {
    throw new Error(`Open-Meteo answered ${response.status}`);
  }

  return schema.parse(await response.json());
};

/** The air, or null when it cannot be had: the weather shows without it. */
const getAir = async (fetcher: typeof fetch) => {
  try {
    return await getJson(AIR_URL, airAnswer, fetcher);
  } catch {
    return null;
  }
};

export const fetchRegion = async (
  fetcher: typeof fetch = fetch
): Promise<RegionReport> => {
  const [weather, air] = await Promise.all([
    getJson(WEATHER_URL, weatherAnswer, fetcher),
    getAir(fetcher),
  ]);

  return toRegion(weather, air);
};
