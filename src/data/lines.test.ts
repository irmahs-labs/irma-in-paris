import { describe, expect, it } from "vitest";

import { FEED_LINES, METRO_LINES, boardableStops, terminusOf } from "./lines";

describe("the lines", () => {
  it("have unique ids, and PRIM's form of line id", () => {
    const ids = FEED_LINES.map((line) => line.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const line of FEED_LINES) {
      expect(line.prim).toMatch(/^line:IDFM:C\d{5}$/u);
    }
  });

  it("list no stop twice on a line", () => {
    for (const line of METRO_LINES) {
      expect(new Set(line.stops).size).toBe(line.stops.length);
    }
  });

  it("board anywhere but the terminus, either way", () => {
    const [line] = METRO_LINES;

    expect(terminusOf(line, 0)).toBe("Château de Vincennes");
    expect(terminusOf(line, 1)).toBe("La Défense");
    expect(boardableStops(line, 0)[0]).toBe("La Défense");
    expect(boardableStops(line, 0)).not.toContain("Château de Vincennes");
    expect(boardableStops(line, 1)[0]).toBe("Château de Vincennes");
    expect(boardableStops(line, 1)).not.toContain("La Défense");
  });
});
