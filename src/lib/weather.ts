/**
 * How the weather screen words and colours its numbers. The scales are the
 * WHO's for the UV index and the European Environment Agency's for the
 * European Air Quality Index.
 */
export interface Level {
  /** Which step of the scale the value is on, from 0. */
  step: number;
  label: string;
}

export const UV_STEPS = [
  "var(--moss)",
  "var(--gold)",
  "var(--terracotta)",
  "var(--danger)",
  "var(--strong)",
];

export const uvLevel = (uv: number): Level & { advice: string } => {
  if (uv < 3) {
    return { advice: "No sun protection needed", label: "low", step: 0 };
  }

  if (uv < 6) {
    return {
      advice: "Sunglasses and sun cream at midday",
      label: "moderate",
      step: 1,
    };
  }

  if (uv < 8) {
    return { advice: "Cover up, find shade at midday", label: "high", step: 2 };
  }

  if (uv < 11) {
    return {
      advice: "Stay out of the midday sun",
      label: "very high",
      step: 3,
    };
  }

  return { advice: "Avoid the sun", label: "extreme", step: 4 };
};

export const AQI_STEPS = [
  "var(--moss)",
  "var(--accent-soft)",
  "var(--gold)",
  "var(--terracotta)",
  "var(--danger)",
  "var(--strong)",
];

const AQI_LABELS = [
  "good",
  "fair",
  "moderate",
  "poor",
  "very poor",
  "extremely poor",
];

export const aqiLevel = (aqi: number): Level => {
  const step = Math.min(5, Math.max(0, Math.ceil(aqi / 20) - 1));

  return { label: AQI_LABELS[step] ?? "", step };
};

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const COMPASS_WORDS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

const sector = (degrees: number) =>
  Math.round((((degrees % 360) + 360) % 360) / 45) % 8;

/** Where the wind comes from: 225 → "SW". */
export const compassOf = (degrees: number) => COMPASS[sector(degrees)] ?? "N";

export const compassWordOf = (degrees: number) =>
  COMPASS_WORDS[sector(degrees)] ?? "north";

const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
});

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "2026-10-29" → "Thu" and "29 Oct". The dates are already Paris's. */
export const dayOf = (date: string) => {
  const at = new Date(`${date}T12:00:00Z`);

  return { date: DATE.format(at), day: DAY.format(at) };
};

/** 597 → "9 h 57" */
export const durationOf = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;

/**
 * Where the sun is on its arc between sunrise and sunset, as a share of the
 * day from 0 to 1, and how long is left. Before sunrise and after sunset it
 * sits on the horizon.
 */
export const sunAt = (minutes: number, sunrise: number, sunset: number) => {
  const share = Math.max(
    0,
    Math.min(1, (minutes - sunrise) / (sunset - sunrise))
  );

  const left = sunset - minutes;

  if (minutes < sunrise) {
    return {
      share,
      status: "before sunrise",
      summary: `sunrise in ${durationOf(sunrise - minutes)}`,
      up: false,
    };
  }

  if (left > 0) {
    return {
      share,
      status: "daytime",
      summary: `${durationOf(left)} of daylight left`,
      up: true,
    };
  }

  return {
    share,
    status: "after sunset",
    summary: "the sun has set",
    up: false,
  };
};
