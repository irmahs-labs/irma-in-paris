import { describe, expect, it } from "vitest";

import type { TownNow } from "./api";
import { LAYERS, SCALES, bandOf, shown } from "./region-scales";

const PARIS: TownNow = {
  aqi: 45,
  humidity: 56,
  lat: 48.8566,
  lon: 2.3522,
  name: "Paris",
  pollen: { grains: 0, kind: "alder" },
  temp: 16,
  windFrom: 297,
  windKmh: 3,
};

describe("the map's scales", () => {
  it("put a value in the last band it reaches", () => {
    expect(bandOf("temperature", -4).label).toBe("below 0°");
    expect(bandOf("temperature", 0).label).toBe("0–5°");
    expect(bandOf("temperature", 14).label).toBe("10–15°");
    expect(bandOf("temperature", 31).label).toBe("25° and over");
    expect(bandOf("pollution", 45).label).toBe("moderate");
    expect(bandOf("pollen", 0).label).toBe("none");
    expect(bandOf("wind", 52).label).toBe("45 km/h and over");
  });

  it("list their bands from lowest to highest", () => {
    for (const layer of LAYERS) {
      const starts = SCALES[layer].bands.map((entry) => entry.from);

      expect(starts.toSorted((a, b) => a - b)).toEqual(starts);
    }
  });

  it("write each reading with its unit", () => {
    expect(shown("temperature", PARIS)).toBe("16°");
    expect(shown("humidity", PARIS)).toBe("56%");
    expect(shown("wind", PARIS)).toBe("3 km/h");
    expect(shown("pollution", { ...PARIS, aqi: null })).toBe("–");
  });
});
