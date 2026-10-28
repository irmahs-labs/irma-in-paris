/**
 * What the server's /api answers, shared by the server that builds it and
 * the screens that show it.
 */

/** The weather drawings: what the sky looks like, not the WMO code itself. */
export type SkyKind =
  | "sun"
  | "moon"
  | "part"
  | "cloud"
  | "fog"
  | "rain"
  | "snow"
  | "storm";

export interface WeatherReport {
  /** When Open-Meteo's current values are from, as an ISO time in Paris. */
  updatedAt: string;
  now: {
    temp: number;
    feelsLike: number;
    sky: SkyKind;
    label: string;
    uv: number;
    windKmh: number;
    gustsKmh: number;
    /** Where the wind blows from, in degrees: 0 is north, 90 east. */
    windFrom: number;
    humidity: number;
    dewPoint: number;
    /** The European Air Quality Index, or null when it could not be read. */
    aqi: number | null;
    pm25: number | null;
  };
  /** The next hours, from the one after now. */
  hourly: { time: string; temp: number; rain: number }[];
  /** Today and the six days after, as dates in Paris. */
  days: {
    date: string;
    sky: SkyKind;
    label: string;
    hi: number;
    lo: number;
    rain: number;
    uv: number;
  }[];
  sun: {
    /** Today's, as "07:30" in Paris. */
    sunrise: string;
    sunset: string;
  };
}

export type LineLevel = "ok" | "warn" | "works";

export interface LineStatus {
  id: string;
  level: LineLevel;
  /** What is happening, in PRIM's words, or that traffic is normal. */
  detail: string;
}

export interface TrafficReport {
  updatedAt: string;
  lines: LineStatus[];
}

export interface Departures {
  /** The next trains from the stop, soonest first. */
  trains: { minutes: number; at: string }[];
}

export interface VelibStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  mechanical: number;
  ebike: number;
  docks: number;
}

export interface VelibReport {
  updatedAt: string;
  stations: VelibStation[];
}

export interface Photo {
  id: string;
  caption: string;
  width: number;
  height: number;
}

export interface Place {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  area: string;
  /** "2026-10-12", or null when the date is not known. */
  visitedOn: string | null;
  dish: string;
  lat: number;
  lon: number;
  photos: Photo[];
}

export interface Me {
  /** Whether the visitor may add and remove places and photos. */
  admin: boolean;
}

/** Why an /api request failed, as its JSON body says. */
export interface ApiError {
  error: string;
}
