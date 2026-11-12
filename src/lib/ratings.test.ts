import { describe, expect, it } from "vitest";

import { averageOf, averageText } from "./ratings";

describe("averageOf", () => {
  it("averages only the ratings that are set", () => {
    expect(averageOf({ food: 5, service: 4, toilet: null, value: 4 })).toBe(
      13 / 3
    );
    expect(
      averageOf({ food: null, service: null, toilet: null, value: null })
    ).toBeNull();
  });
});

describe("averageText", () => {
  it("writes it to one decimal, the French way in French", () => {
    const ratings = { food: 5, service: 4, toilet: null, value: 4 };

    expect(averageText(ratings, "en")).toBe("4.3");
    expect(averageText(ratings, "fr")).toBe("4,3");
    expect(averageText({ ...ratings, service: 5, value: 5 }, "en")).toBe("5.0");
  });
});
