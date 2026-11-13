import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Ratings } from "../src/lib/api";
import { connect } from "./db";
import {
  addPhoto,
  addPlace,
  photoExists,
  rate,
  readPlaces,
  removePhoto,
  removePlace,
} from "./places";

// Runs only against a real, migrated database: after `npm run db:up`, with
// TEST_DATABASE_URL=postgres://irma_in_paris@localhost:5435/irma_in_paris
// The Database workflow runs it in CI.
const url = process.env.TEST_DATABASE_URL;
const ADMIN = "00000000-0000-4000-8000-00000000000a";

const UNRATED: Ratings = {
  food: null,
  service: null,
  toilet: null,
  value: null,
};

const place = (name: string, ratings: Ratings = UNRATED) => ({
  address: "12 Rue de la Roquette 75011 Paris",
  area: "11th",
  cuisine: "Cambodian",
  googlePlaceId: `ChIJ-${name}`,
  lat: 48.8536,
  lon: 2.3707,
  mapsUrl: `https://maps.google.com/?q=${name}`,
  name,
  ratings,
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
  const added = async (name: string, ratings: Ratings = UNRATED) => {
    const row = await addPlace(pool, place(name, ratings));

    if (!row) {
      throw new Error(`${name} was already on the map`);
    }

    return row.id;
  };

  it("lists the most recently added first, with its ratings and its photos in order", async () => {
    const RATED = { food: 5, service: 4, toilet: null, value: 3 };
    const old = await added("Old");
    const fresh = await added("Fresh", RATED);

    await addPhoto(pool, {
      height: 600,
      id: "00000000-0000-4000-8000-000000000001",
      notes: "one",
      placeId: old,
      uploadedBy: ADMIN,
      width: 800,
    });
    await addPhoto(pool, {
      height: 600,
      id: "00000000-0000-4000-8000-000000000002",
      notes: "two",
      placeId: old,
      uploadedBy: ADMIN,
      width: 800,
    });

    const places = await readPlaces(pool);

    expect(places.map((entry) => entry.name)).toEqual(["Fresh", "Old"]);
    const { googlePlaceId: _id, ...shown } = place("Fresh", RATED);

    expect(places[0]).toEqual({ ...shown, id: fresh, photos: [] });
    expect(places[1]?.photos.map((photo) => photo.notes)).toEqual([
      "one",
      "two",
    ]);
  });

  it("rates a place again, and only one that exists", async () => {
    const id = await added("Rated");
    const ratings = { food: 4, service: 2, toilet: 1, value: 5 };

    expect(await rate(pool, id, ratings)).toBe(true);
    expect(await rate(pool, "999", ratings)).toBe(false);

    const [rated] = await readPlaces(pool);

    expect(rated?.ratings).toEqual(ratings);
  });

  it("keeps each Google place once", async () => {
    await added("Twice");

    expect(await addPlace(pool, place("Twice"))).toBeNull();
    expect(await readPlaces(pool)).toHaveLength(1);
  });

  it("adds photos only to a place that exists, and removes them with it", async () => {
    const id = await added("Here");

    const photo = {
      height: 600,
      id: "00000000-0000-4000-8000-000000000003",
      notes: "",
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
