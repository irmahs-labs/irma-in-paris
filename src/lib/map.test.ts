import { describe, expect, it } from "vitest";

import { CENTRAL_PARIS, isInside } from "./map";

describe("the Vélib' box", () => {
  it("holds central Paris and nothing past it", () => {
    expect(isInside(CENTRAL_PARIS, 48.8566, 2.3522)).toBe(true);
    expect(isInside(CENTRAL_PARIS, 48.8584, 2.2945)).toBe(false);
  });
});
