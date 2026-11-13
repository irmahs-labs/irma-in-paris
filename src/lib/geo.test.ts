import { describe, expect, it } from "vitest";

import { metresBetween, nearestTo } from "./geo";

const CHATELET = { lat: 48.8584, lon: 2.3475 };
const HOTEL_DE_VILLE = { lat: 48.8573, lon: 2.3523 };
const BECON = { lat: 48.9047, lon: 2.2689 };

describe("metresBetween", () => {
  it("measures a short walk in Paris to within a few metres", () => {
    expect(Math.round(metresBetween(CHATELET, HOTEL_DE_VILLE))).toBeGreaterThan(
      360
    );
    expect(Math.round(metresBetween(CHATELET, HOTEL_DE_VILLE))).toBeLessThan(
      380
    );
  });
});

describe("nearestTo", () => {
  it("picks the nearest place, and nothing from nothing", () => {
    expect(nearestTo(BECON, [CHATELET, HOTEL_DE_VILLE, BECON])).toBe(BECON);
    expect(nearestTo(CHATELET, [BECON, HOTEL_DE_VILLE])).toBe(HOTEL_DE_VILLE);
    expect(nearestTo(CHATELET, [])).toBeUndefined();
  });
});
