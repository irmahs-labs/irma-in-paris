import { describe, expect, it } from "vitest";

import { areaOf, searchAnswer, toFound } from "./geocode";

const answer = (score: number) =>
  searchAnswer.parse({
    features: [
      {
        geometry: { coordinates: [2.370734, 48.853595] },
        properties: {
          city: "Paris",
          label: "12 Rue de la Roquette 75011 Paris",
          postcode: "75011",
          score,
        },
      },
    ],
  });

describe("areaOf", () => {
  it("names Paris's arrondissements, and other towns by name", () => {
    expect(areaOf("75001", "Paris")).toBe("1er");
    expect(areaOf("75011", "Paris")).toBe("11e");
    expect(areaOf("75116", "Paris")).toBe("16e");
    expect(areaOf("75020", "Paris")).toBe("20e");
    expect(areaOf("93100", "Montreuil")).toBe("Montreuil");
  });
});

describe("toFound", () => {
  it("takes the best match's place and tidy address", () => {
    expect(toFound(answer(0.98))).toEqual({
      address: "12 Rue de la Roquette 75011 Paris",
      area: "11e",
      lat: 48.853595,
      lon: 2.370734,
    });
  });

  it("finds nothing when the geocoder is guessing or empty", () => {
    expect(toFound(answer(0.3))).toBeNull();
    expect(toFound(searchAnswer.parse({ features: [] }))).toBeNull();
  });
});
