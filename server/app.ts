import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as z from "zod/mini";

import { FEED_LINES, METRO_LINES, boardableStops } from "../src/data/lines";
import type { Direction } from "../src/data/lines";
import type {
  ApiError,
  Me,
  Place,
  TrafficReport,
  VelibReport,
  WeatherReport,
} from "../src/lib/api";
import { createCache } from "./cache";
import type { Geocode } from "./geocode";
import type { NewPhoto, NewPlace } from "./places";
import type { Prim } from "./prim";
import type { WhoIs } from "./session";
import type { Storage } from "./storage";
import { jpegSize, photoKey } from "./storage";

interface AppOptions {
  /** The site's own origin; changes from any other are refused. */
  appOrigin: string;
  whoIs: WhoIs;
  weather: () => Promise<WeatherReport>;
  velib: () => Promise<VelibReport>;
  /** Null without a PRIM key: the transport routes then say so. */
  prim: Prim | null;
  geocode: Geocode;
  storage: Storage;
  places: {
    read: () => Promise<Place[]>;
    add: (place: NewPlace) => Promise<Place>;
    /** The ids of the photos that went with it; null when there was no such place. */
    remove: (id: string) => Promise<string[] | null>;
    addPhoto: (photo: NewPhoto) => Promise<boolean>;
    removePhoto: (id: string) => Promise<boolean>;
    photoExists: (id: string) => Promise<boolean>;
  };
  newId?: () => string;
}

interface Variables {
  adminId: string;
}

const trimmed = (max: number) =>
  z.pipe(
    z.string(),
    z.transform((value) => value.trim().replaceAll(/\s+/gu, " ").slice(0, max))
  );

const placeRequest = z.object({
  address: trimmed(200),
  cuisine: z.optional(trimmed(40)),
  dish: z.optional(trimmed(120)),
  name: trimmed(80),
  visitedOn: z.optional(z.string()),
});

const DIRECTIONS = new Map<string, Direction>([
  ["0", 0],
  ["1", 1],
]);

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const PLACE_ID = /^\d{1,18}$/u;

const PHOTO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** A phone photo shrunk to 1600px by the page is well under this. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_SIDE = { large: 2048, thumb: 640 } as const;

const fail = (
  c: Context,
  status: 400 | 403 | 404 | 422 | 502 | 503,
  error: string
) => c.json({ error } satisfies ApiError, status);

/**
 * The server's routes: the weather, Vélib' and PRIM's transport, asked of
 * their APIs and kept a little while, and the places Irma has eaten at, with
 * their photos in Garage. Anyone may look; only admins, as the account
 * service says from the visitor's own cookie, may add or remove, and only
 * from this site's own page.
 */
export const createApp = ({
  appOrigin,
  whoIs,
  weather,
  velib,
  prim,
  geocode,
  storage,
  places,
  newId = randomUUID,
}: AppOptions) => {
  const app = new Hono<{ Variables: Variables }>();
  const weatherCache = createCache<WeatherReport>({ ttlMs: 10 * 60_000 });
  const velibCache = createCache<VelibReport>({ ttlMs: 60_000 });
  const trafficCache = createCache<TrafficReport>({ ttlMs: 2 * 60_000 });

  const departuresCache = createCache<Awaited<ReturnType<Prim["departures"]>>>({
    staleMs: 0,
    ttlMs: 30_000,
  });

  app.onError((thrown, c) => {
    console.error(thrown);

    return c.json({ error: "server" } satisfies ApiError, 500);
  });

  app.get("/healthz", (c) => c.text("ok"));

  app.use("/api/*", (c, next) => {
    // Live data and admin rights; the photos set their own.
    if (!c.req.path.startsWith("/api/photos/")) {
      c.header("cache-control", "no-store");
    }

    return next();
  });

  /** Lets the request on only from an admin, on this site's own page. */
  const adminOnly = async (
    c: Context<{ Variables: Variables }>,
    next: Next
  ) => {
    if (c.req.header("origin") !== appOrigin) {
      return fail(c, 403, "origin");
    }

    const visitor = await whoIs(c.req.header("cookie"));

    if (!(visitor.admin && visitor.id)) {
      return fail(c, 403, "admin");
    }

    c.set("adminId", visitor.id);

    return next();
  };

  app.get("/api/me", async (c) => {
    const visitor = await whoIs(c.req.header("cookie"));

    return c.json({ admin: visitor.admin } satisfies Me);
  });

  app.get("/api/weather", async (c) => {
    try {
      return c.json(await weatherCache("paris", weather));
    } catch (error) {
      console.error("Weather", error);

      return fail(c, 502, "weather");
    }
  });

  app.get("/api/velib", async (c) => {
    try {
      return c.json(await velibCache("central", velib));
    } catch (error) {
      console.error("Vélib'", error);

      return fail(c, 502, "velib");
    }
  });

  app.get("/api/transport/status", async (c) => {
    if (!prim) {
      return fail(c, 503, "no-prim-key");
    }

    try {
      const report = await trafficCache("all", async () => {
        const results = await Promise.allSettled(
          FEED_LINES.map((line) => prim.status(line))
        );

        const lines = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : []
        );

        if (lines.length === 0) {
          throw results.find((result) => result.status === "rejected")?.reason;
        }

        return { lines, updatedAt: new Date().toISOString() };
      });

      return c.json(report);
    } catch (error) {
      console.error("PRIM line status", error);

      return fail(c, 502, "prim");
    }
  });

  app.get("/api/transport/departures", async (c) => {
    if (!prim) {
      return fail(c, 503, "no-prim-key");
    }

    const line = METRO_LINES.find((entry) => entry.id === c.req.query("line"));
    const dir = c.req.query("dir");

    const direction = DIRECTIONS.get(dir ?? "") ?? null;

    const stop = c.req.query("stop") ?? "";

    if (
      !line ||
      direction === null ||
      !boardableStops(line, direction).includes(stop)
    ) {
      return fail(c, 400, "stop");
    }

    try {
      return c.json(
        await departuresCache(`${line.id}|${direction}|${stop}`, () =>
          prim.departures(line, direction, stop)
        )
      );
    } catch (error) {
      console.error("PRIM departures", error);

      return fail(c, 502, "prim");
    }
  });

  app.get("/api/places", async (c) => c.json(await places.read()));

  app.post("/api/places", adminOnly, async (c) => {
    const parsed = placeRequest.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success || !parsed.data.name || !parsed.data.address) {
      return fail(c, 400, "place");
    }

    const {
      name,
      address,
      cuisine = "",
      dish = "",
      visitedOn = "",
    } = parsed.data;

    if (visitedOn && !DATE.test(visitedOn)) {
      return fail(c, 400, "date");
    }

    let found: Awaited<ReturnType<Geocode>>;

    try {
      found = await geocode(address);
    } catch (error) {
      console.error("Geocoding", error);

      return fail(c, 502, "geocoder");
    }

    if (found === null) {
      return fail(c, 422, "address");
    }

    const place = await places.add({
      address: found.address,
      area: found.area,
      cuisine,
      dish,
      lat: found.lat,
      lon: found.lon,
      name,
      visitedOn: visitedOn || null,
    });

    return c.json(place, 201);
  });

  app.delete("/api/places/:id", adminOnly, async (c) => {
    const id = c.req.param("id") ?? "";
    const photos = PLACE_ID.test(id) ? await places.remove(id) : null;

    if (!photos) {
      return fail(c, 404, "place");
    }

    // The rows are gone, so nothing shows them; a file left behind is only space.
    await Promise.allSettled(
      photos.flatMap((photo) => [
        storage.remove(photoKey(photo, "large")),
        storage.remove(photoKey(photo, "thumb")),
      ])
    );

    return c.body(null, 204);
  });

  app.post(
    "/api/places/:id/photos",
    adminOnly,
    bodyLimit({
      maxSize: MAX_PHOTO_BYTES * 1.5,
      onError: (c) => fail(c, 400, "too-big"),
    }),
    async (c) => {
      const placeId = c.req.param("id") ?? "";
      const form = await c.req.formData().catch(() => null);
      const large = form?.get("large");
      const thumb = form?.get("thumb");

      const caption = String(form?.get("caption") ?? "")
        .trim()
        .replaceAll(/\s+/gu, " ")
        .slice(0, 120);

      if (
        !(
          PLACE_ID.test(placeId) &&
          large instanceof File &&
          thumb instanceof File
        )
      ) {
        return fail(c, 400, "photo");
      }

      const largeBytes = new Uint8Array(await large.arrayBuffer());
      const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
      const size = jpegSize(largeBytes);
      const thumbSize = jpegSize(thumbBytes);

      if (
        !(size && thumbSize) ||
        largeBytes.length > MAX_PHOTO_BYTES ||
        Math.max(size.width, size.height) > MAX_SIDE.large ||
        Math.max(thumbSize.width, thumbSize.height) > MAX_SIDE.thumb
      ) {
        return fail(c, 400, "photo");
      }

      const id = newId();

      await storage.put(photoKey(id, "large"), largeBytes, "image/jpeg");
      await storage.put(photoKey(id, "thumb"), thumbBytes, "image/jpeg");

      const forget = () =>
        Promise.allSettled([
          storage.remove(photoKey(id, "large")),
          storage.remove(photoKey(id, "thumb")),
        ]);

      let added: boolean;

      try {
        added = await places.addPhoto({
          caption,
          height: size.height,
          id,
          placeId,
          uploadedBy: c.get("adminId"),
          width: size.width,
        });
      } catch (error) {
        await forget();
        throw error;
      }

      if (!added) {
        await forget();

        return fail(c, 404, "place");
      }

      return c.json(
        { caption, height: size.height, id, width: size.width },
        201
      );
    }
  );

  app.delete("/api/photos/:id", adminOnly, async (c) => {
    const id = c.req.param("id") ?? "";

    if (!(PHOTO_ID.test(id) && (await places.removePhoto(id)))) {
      return fail(c, 404, "photo");
    }

    await Promise.allSettled([
      storage.remove(photoKey(id, "large")),
      storage.remove(photoKey(id, "thumb")),
    ]);

    return c.body(null, 204);
  });

  app.get("/api/photos/:id/:size", async (c) => {
    const id = c.req.param("id") ?? "";
    const size = c.req.param("size") ?? "";

    if (
      !PHOTO_ID.test(id) ||
      (size !== "large" && size !== "thumb") ||
      !(await places.photoExists(id))
    ) {
      c.header("cache-control", "no-store");

      return fail(c, 404, "photo");
    }

    const object = await storage.get(photoKey(id, size));

    if (!object?.body) {
      c.header("cache-control", "no-store");

      return fail(c, 404, "photo");
    }

    // A photo's id is new for every upload, so a cached copy is never stale.
    return c.body(object.body, 200, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/jpeg",
    });
  });

  return app;
};
