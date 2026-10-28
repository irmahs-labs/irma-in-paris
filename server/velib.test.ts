import { describe, expect, it } from "vitest";

import { CENTRAL_PARIS } from "../src/lib/map";
import {
  informationAnswer,
  spreadOut,
  statusAnswer,
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

describe("toVelibReport", () => {
  it("joins the two files by station and leaves out closed stations", () => {
    const information = informationAnswer.parse({
      data: {
        stations: [
          { lat: 48.8565, lon: 2.3524, name: "Hôtel de Ville", station_id: 1 },
          { lat: 48.8584, lon: 2.3475, name: "Châtelet", station_id: 2 },
        ],
      },
    });

    const status = statusAnswer.parse({
      data: {
        stations: [
          {
            is_installed: 1,
            is_renting: 1,
            num_bikes_available_types: [{ mechanical: 3 }, { ebike: 4 }],
            num_docks_available: 20,
            station_id: 1,
          },
          {
            is_installed: 1,
            is_renting: 0,
            num_docks_available: 5,
            station_id: 2,
          },
        ],
      },
    });

    expect(
      toVelibReport(information, status, new Date("2026-10-28T12:00:00Z"))
    ).toEqual({
      stations: [
        {
          docks: 20,
          ebike: 4,
          id: "1",
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

describe("spreadOut", () => {
  it("keeps one station per cell of the map, the one nearest its middle", () => {
    const near = station("near", 48.868, 2.3315);
    const far = station("far", 48.8715, 2.326);
    const outside = station("outside", 48.9, 2.3);
    const picked = spreadOut([far, near, outside], CENTRAL_PARIS);

    expect(picked.map((entry) => entry.id)).toEqual(["near"]);
  });
});
