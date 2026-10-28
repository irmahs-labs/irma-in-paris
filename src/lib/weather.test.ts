import { describe, expect, it } from "vitest";

import {
  aqiLevel,
  compassOf,
  dayOf,
  durationOf,
  sunAt,
  uvLevel,
} from "./weather";

describe("the weather's words", () => {
  it("puts the UV index on the WHO's scale", () => {
    expect(uvLevel(2)).toMatchObject({ label: "low", step: 0 });
    expect(uvLevel(5)).toMatchObject({ label: "moderate", step: 1 });
    expect(uvLevel(7).label).toBe("high");
    expect(uvLevel(11)).toMatchObject({ label: "extreme", step: 4 });
  });

  it("puts the air on the European AQI's six steps", () => {
    expect(aqiLevel(10)).toEqual({ label: "good", step: 0 });
    expect(aqiLevel(34)).toEqual({ label: "fair", step: 1 });
    expect(aqiLevel(60)).toEqual({ label: "moderate", step: 2 });
    expect(aqiLevel(140)).toEqual({ label: "extremely poor", step: 5 });
  });

  it("names where the wind comes from", () => {
    expect(compassOf(0)).toBe("N");
    expect(compassOf(225)).toBe("SW");
    expect(compassOf(267)).toBe("W");
    expect(compassOf(350)).toBe("N");
  });

  it("names the days the forecast is for", () => {
    expect(dayOf("2026-10-29")).toEqual({ date: "29 Oct", day: "Thu" });
  });
});

describe("sunAt", () => {
  const SUNRISE = 7 * 60 + 30;
  const SUNSET = 17 * 60 + 37;

  it("follows the sun from sunrise to sunset", () => {
    expect(sunAt(6 * 60, SUNRISE, SUNSET)).toMatchObject({
      share: 0,
      summary: "sunrise in 1 h 30",
      up: false,
    });
    expect(sunAt(12 * 60 + 33, SUNRISE, SUNSET).share).toBeCloseTo(0.5, 2);
    expect(sunAt(16 * 60, SUNRISE, SUNSET)).toMatchObject({
      summary: "1 h 37 of daylight left",
      up: true,
    });
    expect(sunAt(20 * 60, SUNRISE, SUNSET)).toMatchObject({
      share: 1,
      summary: "the sun has set",
    });
    expect(durationOf(SUNSET - SUNRISE)).toBe("10 h 07");
  });
});
