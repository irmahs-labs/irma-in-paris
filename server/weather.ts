import * as z from "zod/mini";

import type { SkyKind, WeatherReport } from "../src/lib/api";

/** Paris, the Hôtel de Ville. */
const LAT = 48.8566;
const LON = 2.3522;

const FORECAST_URL = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams(
  {
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
    forecast_days: "7",
    forecast_hours: "7",
    hourly: "temperature_2m,precipitation_probability",
    latitude: String(LAT),
    longitude: String(LON),
    timezone: "Europe/Paris",
  }
).toString()}`;

const AIR_URL = `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams(
  {
    current: "european_aqi,pm2_5",
    latitude: String(LAT),
    longitude: String(LON),
    timezone: "Europe/Paris",
  }
).toString()}`;

const numbers = z.array(z.nullable(z.number()));

export const forecastAnswer = z.object({
  current: z.object({
    apparent_temperature: z.number(),
    dew_point_2m: z.number(),
    is_day: z.number(),
    relative_humidity_2m: z.number(),
    temperature_2m: z.number(),
    time: z.string(),
    uv_index: z.nullable(z.number()),
    weather_code: z.number(),
    wind_direction_10m: z.number(),
    wind_gusts_10m: z.number(),
    wind_speed_10m: z.number(),
  }),
  daily: z.object({
    precipitation_probability_max: numbers,
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
    temperature_2m_max: numbers,
    temperature_2m_min: numbers,
    time: z.array(z.string()),
    uv_index_max: numbers,
    weather_code: numbers,
  }),
  hourly: z.object({
    precipitation_probability: numbers,
    temperature_2m: numbers,
    time: z.array(z.string()),
  }),
});

export const airAnswer = z.object({
  current: z.object({
    european_aqi: z.nullable(z.number()),
    pm2_5: z.nullable(z.number()),
  }),
});

export interface Sky {
  sky: SkyKind;
  label: string;
}

/** The WMO codes Open-Meteo uses, by the first code of each group. */
const GROUPS: readonly (readonly [number, number, Sky])[] = [
  [45, 48, { label: "Fog", sky: "fog" }],
  [51, 57, { label: "Drizzle", sky: "rain" }],
  [61, 67, { label: "Rain", sky: "rain" }],
  [71, 77, { label: "Snow", sky: "snow" }],
  [80, 82, { label: "Showers", sky: "rain" }],
  [85, 86, { label: "Snow", sky: "snow" }],
  [95, 99, { label: "Thunderstorm", sky: "storm" }],
];

const CLEAR_DAY: readonly Sky[] = [
  { label: "Sunny", sky: "sun" },
  { label: "Mostly sunny", sky: "sun" },
  { label: "Partly cloudy", sky: "part" },
  { label: "Cloudy", sky: "cloud" },
];

const CLEAR_NIGHT: readonly Sky[] = [
  { label: "Clear", sky: "moon" },
  { label: "Mostly clear", sky: "moon" },
  { label: "Partly cloudy", sky: "cloud" },
  { label: "Cloudy", sky: "cloud" },
];

const CLOUDY: Sky = { label: "Cloudy", sky: "cloud" };

/**
 * A WMO weather code as the screen draws and names it. Clear and mostly
 * clear skies at night get the moon.
 */
export const skyOf = (code: number, isDay = true): Sky => {
  const clear = (isDay ? CLEAR_DAY : CLEAR_NIGHT)[code];

  if (clear) {
    return clear;
  }

  const group = GROUPS.find(([first, last]) => code >= first && code <= last);

  return group?.[2] ?? CLOUDY;
};

const round = (value: number | null | undefined) => Math.round(value ?? 0);

/** "2026-10-28T07:30" → "07:30" */
const clockOf = (time: string | undefined) => time?.slice(11, 16) ?? "";

export type Forecast = z.infer<typeof forecastAnswer>;

export type Air = z.infer<typeof airAnswer>;

/** Open-Meteo's two answers, as the weather screen shows them. */
export const toReport = (
  { current, daily, hourly }: Forecast,
  air: Air | null
): WeatherReport => {
  const now = skyOf(current.weather_code, current.is_day === 1);

  return {
    days: daily.time.map((date, i) => {
      const day = skyOf(daily.weather_code[i] ?? 3);

      return {
        date,
        hi: round(daily.temperature_2m_max[i]),
        label: day.label,
        lo: round(daily.temperature_2m_min[i]),
        rain: round(daily.precipitation_probability_max[i]),
        sky: day.sky,
        uv: round(daily.uv_index_max[i]),
      };
    }),
    // The first hour is the one now is in; the screen shows the ones after.
    hourly: hourly.time.slice(1).map((time, i) => ({
      rain: round(hourly.precipitation_probability[i + 1]),
      temp: round(hourly.temperature_2m[i + 1]),
      time: clockOf(time),
    })),
    now: {
      aqi: air?.current.european_aqi ?? null,
      dewPoint: round(current.dew_point_2m),
      feelsLike: round(current.apparent_temperature),
      gustsKmh: round(current.wind_gusts_10m),
      humidity: round(current.relative_humidity_2m),
      label: now.label,
      pm25: air?.current.pm2_5 ?? null,
      sky: now.sky,
      temp: round(current.temperature_2m),
      uv: round(current.uv_index),
      windFrom: round(current.wind_direction_10m),
      windKmh: round(current.wind_speed_10m),
    },
    sun: {
      sunrise: clockOf(daily.sunrise[0]),
      sunset: clockOf(daily.sunset[0]),
    },
    updatedAt: current.time,
  };
};

const getJson = async <T>(
  url: string,
  schema: z.ZodMiniType<T>,
  fetcher: typeof fetch
): Promise<T> => {
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });

  if (!response.ok) {
    throw new Error(`Open-Meteo answered ${response.status}`);
  }

  return schema.parse(await response.json());
};

/** The air quality, or null when it cannot be had: the weather shows without it. */
const getAir = async (fetcher: typeof fetch) => {
  try {
    return await getJson(AIR_URL, airAnswer, fetcher);
  } catch {
    return null;
  }
};

/**
 * Paris's weather from Open-Meteo, which needs no key. The air quality is a
 * second request; when only it fails, the weather still shows without it.
 */
export const fetchWeather = async (
  fetcher: typeof fetch = fetch
): Promise<WeatherReport> => {
  const [forecast, air] = await Promise.all([
    getJson(FORECAST_URL, forecastAnswer, fetcher),
    getAir(fetcher),
  ]);

  return toReport(forecast, air);
};
