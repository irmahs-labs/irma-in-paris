import { describe, expect, it } from "vitest";

import { withoutTrailingSlashes } from "./router";

describe("withoutTrailingSlashes", () => {
  it("drops every slash at the end", () => {
    expect(withoutTrailingSlashes("/places/")).toBe("/places");
    expect(withoutTrailingSlashes("/places///")).toBe("/places");
    expect(withoutTrailingSlashes("/")).toBe("");
  });

  it("keeps the slashes inside", () => {
    expect(withoutTrailingSlashes("/a//b")).toBe("/a//b");
  });

  it("answers at once for a long run of slashes", () => {
    expect(withoutTrailingSlashes(`${"/".repeat(50_000)}x`)).toBe(
      `${"/".repeat(50_000)}x`
    );
  });
});
