import type { TownNow } from "./api";

/**
 * The five things the Île-de-France map can show, each with its own scale.
 * Magnitudes are one hue, light to dark (humidity blue, wind green, pollen
 * gold); temperature is two hues around a grey middle, cold blue to warm
 * red; the air keeps the European AQI's own six levels, as on the weather
 * screen. Each colour is a swatch with a dark outline beside the number, so
 * it stands out on the light and the dark map alike and the number is
 * always in the text colour.
 */
export type Layer =
  | "pollen"
  | "pollution"
  | "humidity"
  | "temperature"
  | "wind";

export const LAYERS: readonly Layer[] = [
  "pollen",
  "pollution",
  "humidity",
  "temperature",
  "wind",
];

export interface Band {
  /** The lowest value in the band; the first band starts at -Infinity. */
  from: number;
  colour: string;
  label: string;
}

interface Scale {
  name: string;
  unit: string;
  /** Never empty: a value below every band's start is in the first. */
  bands: readonly [Band, ...Band[]];
  /** The town's value for this layer, or null when it could not be read. */
  value: (town: TownNow) => number | null;
}

const band = (from: number, colour: string, label: string): Band => ({
  colour,
  from,
  label,
});

export const SCALES: Record<Layer, Scale> = {
  humidity: {
    bands: [
      band(Number.NEGATIVE_INFINITY, "#93b7e6", "under 40%"),
      band(40, "#6e9fdc", "40–55%"),
      band(55, "#4a7fc4", "55–70%"),
      band(70, "#2f5f9e", "70–85%"),
      band(85, "#1d4277", "85% and over"),
    ],
    name: "Humidity",
    unit: "%",
    value: (town) => town.humidity,
  },
  pollen: {
    bands: [
      band(Number.NEGATIVE_INFINITY, "var(--raised)", "none"),
      band(1, "#e0bd52", "low"),
      band(20, "#cfa12c", "moderate"),
      band(50, "#ad7f14", "high"),
      band(150, "#5c4006", "very high"),
    ],
    name: "Pollen",
    unit: " grains/m³",
    value: (town) => town.pollen?.grains ?? null,
  },
  pollution: {
    bands: [
      band(Number.NEGATIVE_INFINITY, "#5c8f48", "good"),
      band(21, "#afc584", "fair"),
      band(41, "#f2d27a", "moderate"),
      band(61, "#d9786a", "poor"),
      band(81, "#f0675c", "very poor"),
      band(101, "#3b4a42", "extremely poor"),
    ],
    name: "Air pollution",
    unit: " AQI",
    value: (town) => town.aqi,
  },
  temperature: {
    bands: [
      band(Number.NEGATIVE_INFINITY, "#1d4277", "below 0°"),
      band(0, "#4a7fc4", "0–5°"),
      band(5, "#93b7e6", "5–10°"),
      band(10, "#c9ccc4", "10–15°"),
      band(15, "#e9a07a", "15–20°"),
      band(20, "#d0604a", "20–25°"),
      band(25, "#9e3b2e", "25° and over"),
    ],
    name: "Temperature",
    unit: "°",
    value: (town) => town.temp,
  },
  wind: {
    bands: [
      band(Number.NEGATIVE_INFINITY, "#9fc775", "calm, under 10 km/h"),
      band(10, "#7fae55", "10–20 km/h"),
      band(20, "#5c8f48", "20–30 km/h"),
      band(30, "#3f6c2e", "30–45 km/h"),
      band(45, "#27491a", "45 km/h and over"),
    ],
    name: "Wind",
    unit: " km/h",
    value: (town) => town.windKmh,
  },
};

/** The band a value falls in: the last whose start it reaches. */
export const bandOf = (layer: Layer, value: number): Band => {
  const { bands } = SCALES[layer];

  return bands.findLast((entry) => value >= entry.from) ?? bands[0];
};

/** "16°", "56%", "4 km/h", "30 AQI", "0 grains/m³", or "–" when there is no value. */
export const shown = (layer: Layer, town: TownNow) => {
  const value = SCALES[layer].value(town);

  return value === null ? "–" : `${value}${SCALES[layer].unit}`;
};
