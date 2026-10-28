import { describe, expect, it } from "vitest";

import {
  ALL_PARIS,
  CENTRAL_PARIS,
  aspectOf,
  isInside,
  placeOnMap,
} from "./map";

describe("the maps", () => {
  it("keep Paris its shape: wider than tall", () => {
    expect(aspectOf(ALL_PARIS)).toBeCloseTo(1.86, 1);
    expect(aspectOf(CENTRAL_PARIS)).toBeCloseTo(1.31, 1);
  });

  it("place a point from the map's top-left corner", () => {
    expect(placeOnMap(CENTRAL_PARIS, 48.872, 2.325)).toEqual({ x: 0, y: 0 });
    expect(placeOnMap(CENTRAL_PARIS, 48.842, 2.385)).toEqual({
      x: 100,
      y: 100,
    });

    const hotelDeVille = placeOnMap(CENTRAL_PARIS, 48.8566, 2.3522);

    expect(hotelDeVille.x).toBeCloseTo(45, 0);
    expect(hotelDeVille.y).toBeCloseTo(51, 0);
  });

  it("know what is on them", () => {
    expect(isInside(CENTRAL_PARIS, 48.8566, 2.3522)).toBe(true);
    expect(isInside(CENTRAL_PARIS, 48.8584, 2.2945)).toBe(false);
  });
});
