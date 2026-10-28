import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { connect } from "./db";
import {
  addPhoto,
  addPlace,
  photoExists,
  readPlaces,
  removePhoto,
  removePlace,
} from "./places";

// Runs only against a real, migrated database: after `npm run db:up`, with
// TEST_DATABASE_URL=postgres://irma_in_paris:irma_in_paris@localhost:5435/irma_in_paris
// The Database workflow runs it in CI.
const url = process.env.TEST_DATABASE_URL;
const ADMIN = "00000000-0000-4000-8000-00000000000a";

const place = (name: string, visitedOn: string | null) => ({
  address: "12 Rue de la Roquette 75011 Paris",
  area: "11th",
  cuisine: "Cambodian",
  dish: "Lok lak",
  googlePlaceId: `ChIJ-${name}`,
  lat: 48.8536,
  lon: 2.3707,
  mapsUrl: `https://maps.google.com/?q=${name}`,
  name,
  visitedOn,
});

describe.skipIf(!url)("places in Postgres", () => {
  const pool = connect(url ?? "");

  beforeEach(async () => {
    await pool.query("truncate places restart identity cascade");
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Adds a place that is not on the map yet: its id. */
  const added = async (name: string, visitedOn: string | null) => {
    const row = await addPlace(pool, place(name, visitedOn));

    if (!row) {
      throw new Error(`${name} was already on the map`);
    }

    return row.id;
  };

  it("lists the most recently visited first, undated last, each with its photos in order", async () => {
    const old = await added("Old", "2025-01-02");
    const fresh = await added("Fresh", "2026-10-12");

    await added("Undated", null);
    await addPhoto(pool, {
      caption: "one",
      height: 600,
      id: "00000000-0000-4000-8000-000000000001",
      placeId: old,
      uploadedBy: ADMIN,
      width: 800,
    });
    await addPhoto(pool, {
      caption: "two",
      height: 600,
      id: "00000000-0000-4000-8000-000000000002",
      placeId: old,
      uploadedBy: ADMIN,
      width: 800,
    });

    const places = await readPlaces(pool);

    expect(places.map((entry) => entry.name)).toEqual([
      "Fresh",
      "Old",
      "Undated",
    ]);
    const { googlePlaceId: _id, ...shown } = place("Fresh", "2026-10-12");

    expect(places[0]).toEqual({ ...shown, id: fresh, photos: [] });
    expect(places[1]?.photos.map((photo) => photo.caption)).toEqual([
      "one",
      "two",
    ]);
  });

  it("keeps each Google place once", async () => {
    await added("Twice", null);

    expect(await addPlace(pool, place("Twice", "2026-10-12"))).toBeNull();
    expect(await readPlaces(pool)).toHaveLength(1);
  });

  it("adds photos only to a place that exists, and removes them with it", async () => {
    const id = await added("Here", null);

    const photo = {
      caption: "",
      height: 600,
      id: "00000000-0000-4000-8000-000000000003",
      uploadedBy: ADMIN,
      width: 800,
    };

    expect(await addPhoto(pool, { ...photo, placeId: "999" })).toBe(false);
    expect(await addPhoto(pool, { ...photo, placeId: id })).toBe(true);
    expect(await photoExists(pool, photo.id)).toBe(true);
    expect(await removePlace(pool, id)).toEqual([photo.id]);
    expect(await photoExists(pool, photo.id)).toBe(false);
    expect(await removePlace(pool, id)).toBeNull();
    expect(await removePhoto(pool, photo.id)).toBe(false);
  });
});
