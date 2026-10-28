import { describe, expect, it } from "vitest";

import { TOWNS } from "../src/data/towns";
import { airAnswer, strongestPollen, toRegion, weatherAnswer } from "./region";

const weatherAt = (temperature: number) => ({
  current: {
    relative_humidity_2m: 56.4,
    temperature_2m: temperature,
    time: "2026-10-28T15:30",
    wind_direction_10m: 297,
    wind_speed_10m: 3.2,
  },
});

const airAt = (aqi: number | null, grass: number) => ({
  current: {
    alder_pollen: 0,
    birch_pollen: 2.4,
    european_aqi: aqi,
    grass_pollen: grass,
    mugwort_pollen: null,
    olive_pollen: 0,
    ragweed_pollen: 0,
  },
});

describe("strongestPollen", () => {
  it("finds the pollen there is most of", () => {
    expect(strongestPollen(airAt(30, 41.6).current)).toEqual({
      grains: 42,
      kind: "grass",
    });
    expect(strongestPollen(airAt(30, 0).current)).toEqual({
      grains: 2,
      kind: "birch",
    });
  });
});

describe("toRegion", () => {
  it("gives every town its rounded readings, in the towns' order", () => {
    const weather = weatherAnswer.parse(
      TOWNS.map((_, i) => weatherAt(15.6 + i / 10))
    );

    const air = airAnswer.parse(TOWNS.map(() => airAt(29.6, 0)));
    const region = toRegion(weather, air);

    expect(region.updatedAt).toBe("2026-10-28T15:30");
    expect(region.towns).toHaveLength(TOWNS.length);
    expect(region.towns[0]).toEqual({
      aqi: 30,
      humidity: 56,
      lat: 48.8566,
      lon: 2.3522,
      name: "Paris",
      pollen: { grains: 2, kind: "birch" },
      temp: 16,
      windFrom: 297,
      windKmh: 3,
    });
  });

  it("shows the weather without the air when the air could not be had", () => {
    const region = toRegion(
      weatherAnswer.parse(TOWNS.map(() => weatherAt(9))),
      null
    );

    expect(region.towns[3]).toMatchObject({ aqi: null, pollen: null, temp: 9 });
  });
});
