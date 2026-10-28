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
  area: "11e",
  cuisine: "Cambodian",
  dish: "Lok lak",
  lat: 48.8536,
  lon: 2.3707,
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

  it("lists the most recently visited first, undated last, each with its photos in order", async () => {
    const old = await addPlace(pool, place("Old", "2025-01-02"));
    const fresh = await addPlace(pool, place("Fresh", "2026-10-12"));

    await addPlace(pool, place("Undated", null));
    await addPhoto(pool, {
      caption: "one",
      height: 600,
      id: "00000000-0000-4000-8000-000000000001",
      placeId: old.id,
      uploadedBy: ADMIN,
      width: 800,
    });
    await addPhoto(pool, {
      caption: "two",
      height: 600,
      id: "00000000-0000-4000-8000-000000000002",
      placeId: old.id,
      uploadedBy: ADMIN,
      width: 800,
    });

    const places = await readPlaces(pool);

    expect(places.map((entry) => entry.name)).toEqual([
      "Fresh",
      "Old",
      "Undated",
    ]);
    expect(places[0]).toEqual({
      ...place("Fresh", "2026-10-12"),
      id: fresh.id,
      photos: [],
    });
    expect(places[1]?.photos.map((photo) => photo.caption)).toEqual([
      "one",
      "two",
    ]);
  });

  it("adds photos only to a place that exists, and removes them with it", async () => {
    const { id } = await addPlace(pool, place("Here", null));

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
