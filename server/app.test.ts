import { describe, expect, it } from "vitest";

import type { Place } from "../src/lib/api";
import { createApp } from "./app";
import { fakeJpeg } from "./fixtures/jpeg";
import type { GooglePlace, GooglePlaces } from "./google-places";
import type { NewPhoto, NewPlace } from "./places";
import type { Prim, PrimLine } from "./prim";
import type { Visitor } from "./session";
import type { Storage } from "./storage";

const ORIGIN = "http://localhost:5173";
const ADMIN_ID = "00000000-0000-4000-8000-00000000000a";

/** Stands in for the account service: a cookie per visitor. */
const VISITORS = new Map<string, Visitor>([
  ["session=admin", { admin: true, id: ADMIN_ID }],
  [
    "session=friend",
    { admin: false, id: "00000000-0000-4000-8000-00000000000b" },
  ],
]);

const SESSION = "11111111-2222-4333-8444-555555555555";

const CAMBODGE: GooglePlace = {
  address: "20 Rue Alibert, 75010 Paris, France",
  area: "10th",
  cuisine: "Asian",
  lat: 48.8714,
  lon: 2.3672,
  mapsUrl: "https://maps.google.com/?cid=1",
  name: "Le Petit Cambodge",
  placeId: "ChIJ-petit-cambodge",
};

/** Stands in for Google Maps: one restaurant, one museum. */
const google: GooglePlaces = {
  details: (placeId) =>
    Promise.resolve(placeId === CAMBODGE.placeId ? CAMBODGE : null),
  search: (input) =>
    Promise.resolve(
      input.includes("petit")
        ? [
            {
              address: "Rue Alibert, Paris",
              name: CAMBODGE.name,
              placeId: CAMBODGE.placeId,
            },
          ]
        : []
    ),
};

/** A fresh app over in-memory stand-ins for the database, Garage and the APIs. */
const setUp = ({ prim = null }: { prim?: Prim | null } = {}) => {
  const seen = new Set<string>();
  const rows: Place[] = [];
  const objects = new Map<string, Uint8Array>();
  let next = 0;

  const storage: Storage = {
    get: (key) =>
      Promise.resolve(
        objects.has(key)
          ? new Response(new Uint8Array(objects.get(key) ?? []))
          : null
      ),
    put: (key, body) => {
      objects.set(key, body);

      return Promise.resolve();
    },
    remove: (key) => {
      objects.delete(key);

      return Promise.resolve();
    },
  };

  const app = createApp({
    appOrigin: ORIGIN,
    google,
    mapDir: "/nowhere",
    newId: () =>
      `00000000-0000-4000-8000-${String((next += 1)).padStart(12, "0")}`,
    places: {
      add: ({ googlePlaceId, ...place }: NewPlace) => {
        if (seen.has(googlePlaceId)) {
          return Promise.resolve(null);
        }

        seen.add(googlePlaceId);

        const added = { ...place, id: String(rows.length + 1), photos: [] };

        rows.push(added);

        return Promise.resolve(added);
      },
      addPhoto: (photo: NewPhoto) => {
        const place = rows.find((row) => row.id === photo.placeId);

        place?.photos.push({
          caption: photo.caption,
          height: photo.height,
          id: photo.id,
          width: photo.width,
        });

        return Promise.resolve(Boolean(place));
      },
      photoExists: (id) =>
        Promise.resolve(
          rows.some((row) => row.photos.some((photo) => photo.id === id))
        ),
      read: () => Promise.resolve(rows),
      remove: (id) => {
        const at = rows.findIndex((row) => row.id === id);
        const [removed] = at === -1 ? [] : rows.splice(at, 1);

        return Promise.resolve(
          removed ? removed.photos.map((photo) => photo.id) : null
        );
      },
      removePhoto: (id) => {
        for (const row of rows) {
          const at = row.photos.findIndex((photo) => photo.id === id);

          if (at !== -1) {
            row.photos.splice(at, 1);

            return Promise.resolve(true);
          }
        }

        return Promise.resolve(false);
      },
    },
    prim,
    region: () => Promise.reject(new Error("not in these tests")),
    storage,
    velib: () => Promise.reject(new Error("not in these tests")),
    weather: () => Promise.reject(new Error("not in these tests")),
    whoIs: (cookie) =>
      Promise.resolve(VISITORS.get(cookie ?? "") ?? { admin: false, id: null }),
  });

  return { app, objects, rows };
};

const statusOf = async (request: Response | Promise<Response>) => {
  const response = await request;

  return response.status;
};

const jsonOf = async (request: Response | Promise<Response>) => {
  const response = await request;

  return response.json();
};

const asAdmin = { cookie: "session=admin", origin: ORIGIN };

const post = (
  body: Record<string, string>,
  headers: Record<string, string> = asAdmin
) => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json", ...headers },
  method: "POST",
});

const photoForm = (
  large: Uint8Array<ArrayBuffer>,
  thumb: Uint8Array<ArrayBuffer>
) => {
  const form = new FormData();

  form.set("large", new Blob([large], { type: "image/jpeg" }), "large.jpg");
  form.set("thumb", new Blob([thumb], { type: "image/jpeg" }), "thumb.jpg");
  form.set("caption", "  Lok  lak ");

  return form;
};

const ROQUETTE_PLACE = {
  cuisine: "Cambodian",
  placeId: CAMBODGE.placeId,
  session: SESSION,
};

describe("/api/me", () => {
  it("says who is an admin, from the account service only", async () => {
    const { app } = setUp();

    expect(
      await jsonOf(
        app.request("/api/me", { headers: { cookie: "session=admin" } })
      )
    ).toEqual({ admin: true });
    expect(
      await jsonOf(
        app.request("/api/me", { headers: { cookie: "session=friend" } })
      )
    ).toEqual({ admin: false });
    expect(await jsonOf(app.request("/api/me"))).toEqual({
      admin: false,
    });
  });
});

describe("adding and removing places", () => {
  it("lets only an admin add one, from this site's own page", async () => {
    const { app, rows } = setUp();

    expect(
      await statusOf(
        app.request("/api/places", post(ROQUETTE_PLACE, { origin: ORIGIN }))
      )
    ).toBe(403);
    expect(
      await statusOf(
        app.request(
          "/api/places",
          post(ROQUETTE_PLACE, { cookie: "session=friend", origin: ORIGIN })
        )
      )
    ).toBe(403);
    expect(
      await statusOf(
        app.request(
          "/api/places",
          post(ROQUETTE_PLACE, {
            cookie: "session=admin",
            origin: "https://minigames.irmahs.dev",
          })
        )
      )
    ).toBe(403);
    expect(rows).toEqual([]);

    const response = await app.request(
      "/api/places",
      post({ ...ROQUETTE_PLACE, visitedOn: "2026-10-12" })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      address: CAMBODGE.address,
      area: "10th",
      cuisine: "Cambodian",
      mapsUrl: CAMBODGE.mapsUrl,
      name: "Le Petit Cambodge",
      visitedOn: "2026-10-12",
    });
    expect(
      await jsonOf(app.request("/api/places", post(ROQUETTE_PLACE)))
    ).toEqual({ error: "already-added" });
  });

  it("searches Google Maps only for an admin", async () => {
    const { app } = setUp();
    const search = `/api/places/search?q=petit&session=${SESSION}`;

    expect(
      await statusOf(
        app.request(search, { headers: { cookie: "session=friend" } })
      )
    ).toBe(403);
    expect(
      await jsonOf(
        app.request(search, { headers: { cookie: "session=admin" } })
      )
    ).toEqual([
      {
        address: "Rue Alibert, Paris",
        name: "Le Petit Cambodge",
        placeId: CAMBODGE.placeId,
      },
    ]);
    expect(
      await jsonOf(
        app.request(
          `/api/places/pick?id=${CAMBODGE.placeId}&session=${SESSION}`,
          { headers: { cookie: "session=admin" } }
        )
      )
    ).toEqual({
      address: CAMBODGE.address,
      cuisine: "Asian",
      name: CAMBODGE.name,
      placeId: CAMBODGE.placeId,
    });
  });

  it("refuses a cuisine off the menu, a bad date, or a place Google does not list as a restaurant", async () => {
    const { app } = setUp();

    expect(
      await statusOf(
        app.request(
          "/api/places",
          post({ ...ROQUETTE_PLACE, cuisine: "Martian" })
        )
      )
    ).toBe(400);
    expect(
      await statusOf(
        app.request(
          "/api/places",
          post({ ...ROQUETTE_PLACE, visitedOn: "last week" })
        )
      )
    ).toBe(400);
    expect(
      await statusOf(
        app.request(
          "/api/places",
          post({ cuisine: "French", session: SESSION })
        )
      )
    ).toBe(400);

    const museum = await app.request(
      "/api/places",
      post({ ...ROQUETTE_PLACE, placeId: "ChIJ-the-louvre" })
    );

    expect(museum.status).toBe(422);
    expect(await museum.json()).toEqual({ error: "not-a-restaurant" });
  });

  it("takes a place's photos out of Garage with it", async () => {
    const { app, objects } = setUp();

    await app.request("/api/places", post(ROQUETTE_PLACE));
    await app.request("/api/places/1/photos", {
      body: photoForm(fakeJpeg(1600, 1200), fakeJpeg(480, 360)),
      headers: asAdmin,
      method: "POST",
    });
    expect(objects.size).toBe(2);

    expect(
      await statusOf(
        app.request("/api/places/1", {
          headers: { cookie: "session=friend", origin: ORIGIN },
          method: "DELETE",
        })
      )
    ).toBe(403);
    expect(
      await statusOf(
        app.request("/api/places/1", {
          headers: asAdmin,
          method: "DELETE",
        })
      )
    ).toBe(204);
    expect(objects.size).toBe(0);
    expect(
      await statusOf(
        app.request("/api/places/1", {
          headers: asAdmin,
          method: "DELETE",
        })
      )
    ).toBe(404);
  });
});

describe("photos", () => {
  it("stores an admin's photo in Garage and serves it to anyone, cached for good", async () => {
    const { app, objects } = setUp();

    await app.request("/api/places", post(ROQUETTE_PLACE));

    const response = await app.request("/api/places/1/photos", {
      body: photoForm(fakeJpeg(1600, 1200), fakeJpeg(480, 360)),
      headers: asAdmin,
      method: "POST",
    });

    const photo = await response.json();

    expect(response.status).toBe(201);
    expect(photo).toEqual({
      caption: "Lok lak",
      height: 1200,
      id: "00000000-0000-4000-8000-000000000001",
      width: 1600,
    });
    expect([...objects.keys()]).toEqual([
      "photos/00000000-0000-4000-8000-000000000001/large.jpg",
      "photos/00000000-0000-4000-8000-000000000001/thumb.jpg",
    ]);

    const image = await app.request(`/api/photos/${photo.id}/thumb`);

    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/jpeg");
    expect(image.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(
      fakeJpeg(480, 360)
    );
    expect(
      await statusOf(app.request(`/api/photos/${photo.id}/original`))
    ).toBe(404);
  });

  it("refuses photos from anyone but an admin, and anything that is not a JPEG of the right size", async () => {
    const { app, objects } = setUp();

    await app.request("/api/places", post(ROQUETTE_PLACE));

    const send = (form: FormData, headers = asAdmin) =>
      app.request("/api/places/1/photos", {
        body: form,
        headers,
        method: "POST",
      });

    expect(
      await statusOf(
        send(photoForm(fakeJpeg(1600, 1200), fakeJpeg(480, 360)), {
          cookie: "session=friend",
          origin: ORIGIN,
        })
      )
    ).toBe(403);
    expect(
      await statusOf(
        send(photoForm(new Uint8Array([1, 2, 3]), fakeJpeg(480, 360)))
      )
    ).toBe(400);
    expect(
      await statusOf(send(photoForm(fakeJpeg(4000, 3000), fakeJpeg(480, 360))))
    ).toBe(400);
    expect(
      await statusOf(
        send(photoForm(fakeJpeg(1600, 1200), fakeJpeg(1600, 1200)))
      )
    ).toBe(400);
    expect(objects.size).toBe(0);

    const elsewhere = await app.request("/api/places/9/photos", {
      body: photoForm(fakeJpeg(1600, 1200), fakeJpeg(480, 360)),
      headers: asAdmin,
      method: "POST",
    });

    expect(elsewhere.status).toBe(404);
    expect(objects.size).toBe(0);
  });

  it("lets an admin remove a photo, files and all", async () => {
    const { app, objects } = setUp();

    await app.request("/api/places", post(ROQUETTE_PLACE));

    const { id } = await jsonOf(
      app.request("/api/places/1/photos", {
        body: photoForm(fakeJpeg(800, 600), fakeJpeg(480, 360)),
        headers: asAdmin,
        method: "POST",
      })
    );

    expect(
      await statusOf(
        app.request(`/api/photos/${id}`, {
          headers: { origin: ORIGIN },
          method: "DELETE",
        })
      )
    ).toBe(403);
    expect(
      await statusOf(
        app.request(`/api/photos/${id}`, {
          headers: asAdmin,
          method: "DELETE",
        })
      )
    ).toBe(204);
    expect(objects.size).toBe(0);
    expect(await statusOf(app.request(`/api/photos/${id}/large`))).toBe(404);
  });
});

describe("transport", () => {
  const METRO_1: PrimLine = {
    code: "1",
    colour: "#ffcd00",
    ink: "#000000",
    key: "metro:1",
    mode: "metro",
    prim: "line:IDFM:C01371",
    title: "Metro 1",
  };

  it("says live times are off without a PRIM key, and still lists every line", async () => {
    const { app } = setUp();

    const response = await app.request(
      "/api/transport/departures?line=metro:1&stop=stop_area:IDFM:71264"
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "no-prim-key" });

    const lines = await jsonOf(app.request("/api/transport/lines"));

    expect(lines.live).toBe(false);
    expect(lines.lines).toHaveLength(29);
  });

  it("asks PRIM only for a stop on that line, as PRIM lists it", async () => {
    const asked: string[] = [];

    const prim: Prim = {
      departures: (line, stopId) => {
        asked.push(`${line.key} ${stopId}`);

        return Promise.resolve({
          directions: [
            { towards: "La Défense", trains: [{ at: "14:31", minutes: 1 }] },
          ],
        });
      },
      lines: () => Promise.resolve([METRO_1]),
      statuses: (lines) =>
        Promise.resolve(
          lines.map((line) => ({
            detail: "Traffic normal on the whole line",
            key: line.key,
            level: "ok" as const,
          }))
        ),
      stops: () =>
        Promise.resolve([{ id: "stop_area:IDFM:71264", name: "Châtelet" }]),
    };

    const { app } = setUp({ prim });

    const ask = (query: string) =>
      app.request(`/api/transport/departures?${query}`);

    expect(await statusOf(ask("line=metro:1&stop=stop_area:IDFM:71264"))).toBe(
      200
    );
    expect(await statusOf(ask("line=metro:1&stop=stop_area:IDFM:99999"))).toBe(
      400
    );
    expect(await statusOf(ask("line=metro:2&stop=stop_area:IDFM:71264"))).toBe(
      400
    );
    expect(asked).toEqual(["metro:1 stop_area:IDFM:71264"]);

    const lines = await jsonOf(app.request("/api/transport/lines"));

    expect(lines).toEqual({
      lines: [
        {
          code: "1",
          colour: "#ffcd00",
          ink: "#000000",
          key: "metro:1",
          mode: "metro",
          title: "Metro 1",
        },
      ],
      live: true,
    });

    const status = await jsonOf(app.request("/api/transport/status"));

    expect(status.lines).toEqual([
      {
        detail: "Traffic normal on the whole line",
        key: "metro:1",
        level: "ok",
      },
    ]);
  });
});
