import { describe, expect, it } from "vitest";

import { createCache } from "./cache";

const broken = () => Promise.reject(new Error("down"));

describe("createCache", () => {
  it("asks once per window, and shares a request in flight", async () => {
    let time = 0;
    let calls = 0;
    const cache = createCache<number>({ now: () => time, ttlMs: 1000 });

    const load = () => {
      calls += 1;

      return Promise.resolve(calls);
    };

    expect(await Promise.all([cache("k", load), cache("k", load)])).toEqual([
      1, 1,
    ]);
    time = 999;
    expect(await cache("k", load)).toBe(1);
    time = 1000;
    expect(await cache("k", load)).toBe(2);
    expect(calls).toBe(2);
  });

  it("serves the last good answer while a fresh one fails, until it is too old", async () => {
    let time = 0;

    const cache = createCache<string>({
      now: () => time,
      staleMs: 5000,
      ttlMs: 1000,
    });

    await cache("k", () => Promise.resolve("good"));
    time = 2000;
    expect(await cache("k", broken)).toBe("good");
    time = 6000;
    await expect(cache("k", broken)).rejects.toThrow("down");
  });
});
