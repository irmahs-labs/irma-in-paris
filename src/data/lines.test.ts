import { describe, expect, it } from "vitest";

import { CUISINES, cuisineOf, isCuisine } from "./cuisines";
import { LINES, lineOrder, shownCode } from "./lines";

const codes = (mode: string) =>
  LINES.filter((line) => line.mode === mode).map((line) => line.code);

describe("the lines", () => {
  it("are every metro, RER and Transilien line, once each, in order", () => {
    expect(codes("metro")).toEqual([
      "1",
      "2",
      "3",
      "3B",
      "4",
      "5",
      "6",
      "7",
      "7B",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
    ]);
    expect(codes("rer")).toEqual(["A", "B", "C", "D", "E"]);
    expect(codes("transilien")).toEqual([
      "H",
      "J",
      "K",
      "L",
      "N",
      "P",
      "R",
      "U",
    ]);
    expect(LINES.toSorted(lineOrder)).toEqual(LINES);
    expect(new Set(LINES.map((line) => line.key)).size).toBe(LINES.length);
  });

  it("name 3bis and 7bis as the signs do", () => {
    expect(shownCode("3B")).toBe("3bis");
    expect(shownCode("14")).toBe("14");
    expect(LINES.find((line) => line.key === "metro:7B")?.title).toBe(
      "Metro 7bis"
    );
  });
});

describe("the cuisines", () => {
  it("are a fixed menu, picked from Google's type where it has one", () => {
    expect(isCuisine("Peruvian")).toBe(true);
    expect(isCuisine("peruvian")).toBe(false);
    expect(new Set(CUISINES).size).toBe(CUISINES.length);
    expect(cuisineOf(["restaurant", "food", "chinese_restaurant"])).toBe(
      "Chinese"
    );
    expect(cuisineOf(["restaurant", "food"])).toBeNull();
  });
});
