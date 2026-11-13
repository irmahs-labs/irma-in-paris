import { describe, expect, it } from "vitest";

import { CENTRAL_PARIS } from "../src/lib/map";
import {
  fetchVelib,
  nearUrl,
  recordsUrl,
  spreadOut,
  stationsAnswer,
  toVelibReport,
} from "./velib";

const station = (id: string, lat: number, lon: number) => ({
  docks: 10,
  ebike: 1,
  id,
  lat,
  lon,
  mechanical: 2,
  name: id,
});

/** Two stations as Paris's open-data portal lists them, one of them not renting. */
const RECORDS = [
  {
    coordonnees_geo: { lat: 48.8565, lon: 2.3524 },
    ebike: 4,
    is_installed: "OUI",
    is_renting: "OUI",
    mechanical: 3,
    name: "Hôtel de Ville",
    numdocksavailable: 20,
    stationcode: "4001",
  },
  {
    coordonnees_geo: { lat: 48.8584, lon: 2.3475 },
    ebike: 0,
    is_installed: "OUI",
    is_renting: "NON",
    mechanical: 1,
    name: "Châtelet",
    numdocksavailable: 5,
    stationcode: "1001",
  },
];

describe("toVelibReport", () => {
  it("keeps the open stations and leaves out the closed ones", () => {
    expect(
      toVelibReport(
        stationsAnswer.parse(RECORDS),
        new Date("2026-10-28T12:00:00Z")
      )
    ).toEqual({
      stations: [
        {
          docks: 20,
          ebike: 4,
          id: "4001",
          lat: 48.8565,
          lon: 2.3524,
          mechanical: 3,
          name: "Hôtel de Ville",
        },
      ],
      updatedAt: "2026-10-28T12:00:00.000Z",
    });
  });
});

describe("fetchVelib", () => {
  it("asks the portal for the stations inside the map's box only", async () => {
    const asked: string[] = [];

    const report = await fetchVelib(undefined, (url) => {
      asked.push(String(url));

      return Promise.resolve(Response.json(RECORDS));
    });

    const where = new URL(asked[0] ?? "").searchParams.get("where");

    expect(asked).toEqual([recordsUrl()]);
    expect(where).toBe(
      `in_bbox(coordonnees_geo, ${CENTRAL_PARIS.south}, ${CENTRAL_PARIS.west}, ${CENTRAL_PARIS.north}, ${CENTRAL_PARIS.east})`
    );
    expect(report.stations.map((entry) => entry.id)).toEqual(["4001"]);
  });

  it("asks for the stations nearest a point, the nearest first, closed ones left out", async () => {
    const asked: string[] = [];

    const report = await fetchVelib({ lat: 48.905, lon: 2.269 }, (url) => {
      asked.push(String(url));

      return Promise.resolve(Response.json(RECORDS));
    });

    const query = new URL(asked[0] ?? "").searchParams;

    expect(asked[0]).toBe(nearUrl(48.905, 2.269));
    expect(query.get("where")).toBe(
      "within_distance(coordonnees_geo, geom'POINT(2.269 48.905)', 1000m)"
    );
    expect(query.get("order_by")).toBe(
      "distance(coordonnees_geo, geom'POINT(2.269 48.905)')"
    );
    expect(report.stations.map((entry) => entry.id)).toEqual(["4001"]);
  });

  it("says what the portal answered when it refuses", async () => {
    await expect(
      fetchVelib(undefined, () =>
        Promise.resolve(new Response("<!DOCTYPE html>", { status: 403 }))
      )
    ).rejects.toThrow("Vélib' answered 403");
  });
});

describe("spreadOut", () => {
  it("keeps one station per cell of the map, the one nearest its middle", () => {
    const near = station("near", 48.868, 2.3315);
    const far = station("far", 48.8715, 2.326);
    const outside = station("outside", 48.9, 2.3);
    const picked = spreadOut([far, near, outside], CENTRAL_PARIS);

    expect(picked.map((entry) => entry.id)).toEqual(["near"]);
  });
});
