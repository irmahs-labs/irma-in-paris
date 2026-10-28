import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { rangeOf, serveRanges } from "./map-file";

describe("rangeOf", () => {
  it("reads the one range MapLibre asks for, clamped to the file", () => {
    expect(rangeOf(undefined, 100)).toBeNull();
    expect(rangeOf("bytes=0-9", 100)).toEqual({ end: 9, start: 0 });
    expect(rangeOf("bytes=90-200", 100)).toEqual({ end: 99, start: 90 });
    expect(rangeOf("bytes=95-", 100)).toEqual({ end: 99, start: 95 });
    expect(rangeOf("bytes=-10", 100)).toEqual({ end: 99, start: 90 });
  });

  it("refuses what the file does not have", () => {
    expect(rangeOf("bytes=100-120", 100)).toBeUndefined();
    expect(rangeOf("bytes=0-1,5-9", 100)).toBeUndefined();
    expect(rangeOf("items=0-9", 100)).toBeUndefined();
  });
});

describe("serveRanges", () => {
  it("answers a range with just those bytes", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "map-"));
    const file = path.join(dir, "paris.pmtiles");

    await writeFile(file, "0123456789");

    const part = await serveRanges(
      file,
      new Request("http://x/", { headers: { range: "bytes=2-5" } })
    );

    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await part.text()).toBe("2345");

    const whole = await serveRanges(file, new Request("http://x/"));

    expect(whole.status).toBe(200);
    expect(await whole.text()).toBe("0123456789");

    const missing = await serveRanges(
      path.join(dir, "none"),
      new Request("http://x/")
    );

    expect(missing.status).toBe(404);
  });
});
