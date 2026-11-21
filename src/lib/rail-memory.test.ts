import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_TRIPS,
  saveLine,
  saveTrip,
  savedLine,
  savedTrip,
} from "./rail-memory";

/** A browser's localStorage, kept in a Map. */
const storage = () => {
  const items = new Map<string, string>();

  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
};

let local = storage();

beforeEach(() => {
  local = storage();
  vi.stubGlobal("window", { localStorage: local });
});

afterEach(() => vi.unstubAllGlobals());

describe("the rail screen's memory", () => {
  it("keeps the line picked last", () => {
    expect(savedLine()).toBeUndefined();

    saveLine("transilien:C01739");

    expect(savedLine()).toBe("transilien:C01739");
  });

  it("keeps each line's last trip", () => {
    expect(savedTrip("transilien:C01739")).toEqual({ from: null, to: null });

    saveTrip("transilien:C01739", {
      from: "stop_area:IDFM:71370",
      to: "stop_area:IDFM:71410",
    });
    saveTrip("rer:A", { from: null, to: "stop_area:IDFM:71264" });

    expect(savedTrip("transilien:C01739")).toEqual({
      from: "stop_area:IDFM:71370",
      to: "stop_area:IDFM:71410",
    });
    expect(savedTrip("rer:A")).toEqual({
      from: null,
      to: "stop_area:IDFM:71264",
    });
  });

  it("keeps the newest lines only", () => {
    for (let index = 0; index <= MAX_TRIPS; index += 1) {
      saveTrip(`line-${index}`, { from: null, to: `stop-${index}` });
    }

    expect(savedTrip("line-0").to).toBeNull();
    expect(savedTrip(`line-${MAX_TRIPS}`).to).toBe(`stop-${MAX_TRIPS}`);
  });

  it("forgets a stop that doesn't read as one, and a damaged list", () => {
    local.setItem(
      "rail:trips",
      JSON.stringify([
        ["rer:B", { from: 7, to: "<script>" }],
        ["rer:C", { to: "stop_area:IDFM:1" }],
      ])
    );
    local.setItem("rail:line", "<b>");

    expect(savedTrip("rer:B")).toEqual({ from: null, to: null });
    expect(savedTrip("rer:C")).toEqual({ from: null, to: "stop_area:IDFM:1" });
    expect(savedLine()).toBeUndefined();

    local.setItem("rail:trips", JSON.stringify(["nope"]));

    expect(savedTrip("rer:C")).toEqual({ from: null, to: null });

    local.setItem("rail:trips", "{broken");

    expect(savedTrip("rer:C")).toEqual({ from: null, to: null });
  });
});
