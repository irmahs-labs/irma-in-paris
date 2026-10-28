import { describe, expect, it } from "vitest";

import { airAnswer, forecastAnswer, skyOf, toReport } from "./weather";

// Trimmed from a real answer, 28 October 2026 at 00:45 in Paris.
const FORECAST = forecastAnswer.parse({
  current: {
    apparent_temperature: 8.7,
    dew_point_2m: 7.7,
    is_day: 0,
    relative_humidity_2m: 84,
    temperature_2m: 10.3,
    time: "2026-10-28T00:45",
    uv_index: 0,
    weather_code: 0,
    wind_direction_10m: 267,
    wind_gusts_10m: 12.2,
    wind_speed_10m: 6.5,
  },
  daily: {
    precipitation_probability_max: [0, 70],
    sunrise: ["2026-10-28T07:30", "2026-10-29T07:32"],
    sunset: ["2026-10-28T17:37", "2026-10-29T17:35"],
    temperature_2m_max: [15.1, 14.9],
    temperature_2m_min: [7.6, 7.5],
    time: ["2026-10-28", "2026-10-29"],
    uv_index_max: [2.7, 2.45],
    weather_code: [2, 61],
  },
  hourly: {
    precipitation_probability: [0, 5, 10],
    temperature_2m: [10.6, 10.2, 9.6],
    time: ["2026-10-28T00:00", "2026-10-28T01:00", "2026-10-28T02:00"],
  },
});

const AIR = airAnswer.parse({ current: { european_aqi: 34, pm2_5: 8.4 } });

describe("skyOf", () => {
  it("names and draws the WMO codes", () => {
    expect(skyOf(0)).toEqual({ label: "Sunny", sky: "sun" });
    expect(skyOf(0, false)).toEqual({ label: "Clear", sky: "moon" });
    expect(skyOf(2)).toEqual({ label: "Partly cloudy", sky: "part" });
    expect(skyOf(3).sky).toBe("cloud");
    expect(skyOf(45).sky).toBe("fog");
    expect(skyOf(53).sky).toBe("rain");
    expect(skyOf(81)).toEqual({ label: "Showers", sky: "rain" });
    expect(skyOf(73).sky).toBe("snow");
    expect(skyOf(96).sky).toBe("storm");
    expect(skyOf(42).sky).toBe("cloud");
  });
});

describe("toReport", () => {
  it("rounds the numbers and keeps the hours after now", () => {
    const report = toReport(FORECAST, AIR);

    expect(report.now).toMatchObject({
      aqi: 34,
      feelsLike: 9,
      humidity: 84,
      label: "Clear",
      sky: "moon",
      temp: 10,
      windFrom: 267,
      windKmh: 7,
    });
    expect(report.hourly).toEqual([
      { rain: 5, temp: 10, time: "01:00" },
      { rain: 10, temp: 10, time: "02:00" },
    ]);
    expect(report.days[1]).toMatchObject({
      hi: 15,
      label: "Rain",
      lo: 8,
      rain: 70,
      sky: "rain",
    });
    expect(report.sun).toEqual({ sunrise: "07:30", sunset: "17:37" });
  });

  it("shows the weather without the air quality when that failed", () => {
    expect(toReport(FORECAST, null).now).toMatchObject({
      aqi: null,
      pm25: null,
      temp: 10,
    });
  });
});
