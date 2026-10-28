import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as z from "zod/mini";

import { isCuisine } from "../src/data/cuisines";
import { LINES } from "../src/data/lines";
import type {
  ApiError,
  Departures,
  LinesReport,
  Me,
  Stop,
  PickedPlace,
  Place,
  TrafficReport,
  VelibReport,
  WeatherReport,
} from "../src/lib/api";
import { createCache } from "./cache";
import type { GooglePlace, GooglePlaces } from "./google-places";
import { createLimiter } from "./limiter";
import { serveRanges } from "./map-file";
import type { NewPhoto, NewPlace } from "./places";
import type { Prim, PrimLine } from "./prim";
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
  /** Null without a Google Maps key: adding places then says so. */
  google: GooglePlaces | null;
  storage: Storage;
  /** Where the PMTiles map of Paris is on disk. */
  mapFile: string;
  places: {
    read: () => Promise<Place[]>;
    /** Null when that Google place is already on the map. */
    add: (place: NewPlace) => Promise<Place | null>;
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

/** Google's place ids and the page's session tokens, as far as the server lets them through. */
const GOOGLE_ID = /^[\w-]{10,300}$/u;
const SESSION = /^[0-9a-f-]{36}$/u;

/** Plenty for typing a name; too few to run up a bill. */
const SEARCHES_PER_MINUTE = 60;

const placeRequest = z.object({
  cuisine: z.string(),
  dish: z.optional(trimmed(120)),
  placeId: z.string().check(z.regex(GOOGLE_ID)),
  session: z.optional(z.string().check(z.regex(SESSION))),
  visitedOn: z.optional(z.string()),
});

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const PLACE_ID = /^\d{1,18}$/u;

const PHOTO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** A phone photo shrunk to 1600px by the page is well under this. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_SIDE = { large: 2048, thumb: 640 } as const;

const fail = (
  c: Context,
  status: 400 | 403 | 404 | 409 | 422 | 429 | 502 | 503,
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
  google,
  mapFile,
  storage,
  places,
  newId = randomUUID,
}: AppOptions) => {
  const app = new Hono<{ Variables: Variables }>();
  const weatherCache = createCache<WeatherReport>({ ttlMs: 10 * 60_000 });
  const velibCache = createCache<VelibReport>({ ttlMs: 60_000 });
  const trafficCache = createCache<TrafficReport>({ ttlMs: 2 * 60_000 });

  const departuresCache = createCache<Departures>({
    staleMs: 0,
    ttlMs: 30_000,
  });

  const linesCache = createCache<PrimLine[]>({ ttlMs: 24 * 60 * 60_000 });
  const stopsCache = createCache<Stop[]>({ ttlMs: 24 * 60 * 60_000 });

  app.onError((thrown, c) => {
    console.error(thrown);

    return c.json({ error: "server" } satisfies ApiError, 500);
  });

  app.get("/healthz", (c) => c.text("ok"));

  app.on(["GET", "HEAD"], "/tiles/paris.pmtiles", (c) =>
    serveRanges(mapFile, c.req.raw)
  );

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

  /** PRIM's lines, asked once a day: they change with the timetable, not the hour. */
  const linesOf = (live: Prim) => linesCache("all", () => live.lines());

  /** The line a `?line=` names, from PRIM's own list; null when there is none. */
  const lineAt = async (live: Prim, key: string | undefined) => {
    const lines = await linesOf(live);

    return lines.find((line) => line.key === key) ?? null;
  };

  /** Whether a stop is on a line, as PRIM lists the line's stops. */
  const isOnLine = async (live: Prim, line: PrimLine, stopId: string) => {
    const stops = await stopsCache(line.key, () => live.stops(line));

    return stops.some((stop) => stop.id === stopId);
  };

  app.get("/api/transport/lines", async (c) => {
    if (!prim) {
      return c.json({ lines: [...LINES], live: false } satisfies LinesReport);
    }

    try {
      const lines = await linesOf(prim);

      return c.json({
        lines: lines.map(({ prim: _id, ...line }) => line),
        live: true,
      } satisfies LinesReport);
    } catch (error) {
      console.error("PRIM lines", error);

      return c.json({ lines: [...LINES], live: false } satisfies LinesReport);
    }
  });

  app.get("/api/transport/stops", async (c) => {
    if (!prim) {
      return fail(c, 503, "no-prim-key");
    }

    try {
      const line = await lineAt(prim, c.req.query("line"));

      if (!line) {
        return fail(c, 400, "line");
      }

      return c.json(await stopsCache(line.key, () => prim.stops(line)));
    } catch (error) {
      console.error("PRIM stops", error);

      return fail(c, 502, "prim");
    }
  });

  app.get("/api/transport/status", async (c) => {
    if (!prim) {
      return fail(c, 503, "no-prim-key");
    }

    try {
      const report = await trafficCache("all", async () => ({
        lines: await prim.statuses(await linesOf(prim)),
        updatedAt: new Date().toISOString(),
      }));

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

    try {
      const line = await lineAt(prim, c.req.query("line"));
      const stopId = c.req.query("stop") ?? "";

      // Only a stop on that line, as PRIM lists it: nothing else is asked of PRIM.
      if (!(line && (await isOnLine(prim, line, stopId)))) {
        return fail(c, 400, "stop");
      }

      return c.json(
        await departuresCache(`${line.key}|${stopId}`, () =>
          prim.departures(line, stopId)
        )
      );
    } catch (error) {
      console.error("PRIM departures", error);

      return fail(c, 502, "prim");
    }
  });

  app.get("/api/places", async (c) => c.json(await places.read()));

  /** Google's details for a place, kept a few minutes so a pick and its add cost one. */
  const picked = createCache<GooglePlace | null>({
    staleMs: 0,
    ttlMs: 10 * 60_000,
  });

  const searches = createLimiter({
    max: SEARCHES_PER_MINUTE,
    windowMs: 60_000,
  });

  /** Lets the request on only from an admin: for reads, which browsers send without an Origin. */
  const adminReads = async (
    c: Context<{ Variables: Variables }>,
    next: Next
  ) => {
    const visitor = await whoIs(c.req.header("cookie"));

    if (!(visitor.admin && visitor.id)) {
      return fail(c, 403, "admin");
    }

    c.set("adminId", visitor.id);

    return next();
  };

  app.get("/api/places/search", adminReads, async (c) => {
    if (!google) {
      return fail(c, 503, "no-google-key");
    }

    const query = (c.req.query("q") ?? "").trim().slice(0, 100);
    const session = c.req.query("session") ?? "";

    if (query.length < 2 || !SESSION.test(session)) {
      return fail(c, 400, "search");
    }

    if (!searches.allow(c.get("adminId"))) {
      return fail(c, 429, "slow-down");
    }

    try {
      return c.json(await google.search(query, session));
    } catch (error) {
      console.error("Google Places search", error);

      return fail(c, 502, "google");
    }
  });

  app.get("/api/places/pick", adminReads, async (c) => {
    if (!google) {
      return fail(c, 503, "no-google-key");
    }

    const placeId = c.req.query("id") ?? "";
    const session = c.req.query("session");

    if (!GOOGLE_ID.test(placeId) || (session && !SESSION.test(session))) {
      return fail(c, 400, "pick");
    }

    try {
      const place = await picked(placeId, () =>
        google.details(placeId, session)
      );

      if (!place) {
        return fail(c, 422, "not-a-restaurant");
      }

      return c.json({
        address: place.address,
        cuisine: place.cuisine,
        name: place.name,
        placeId: place.placeId,
      } satisfies PickedPlace);
    } catch (error) {
      console.error("Google Places details", error);

      return fail(c, 502, "google");
    }
  });

  app.post("/api/places", adminOnly, async (c) => {
    if (!google) {
      return fail(c, 503, "no-google-key");
    }

    const parsed = placeRequest.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) {
      return fail(c, 400, "place");
    }

    const {
      placeId,
      session,
      cuisine,
      dish = "",
      visitedOn = "",
    } = parsed.data;

    if (!isCuisine(cuisine)) {
      return fail(c, 400, "cuisine");
    }

    if (visitedOn && !DATE.test(visitedOn)) {
      return fail(c, 400, "date");
    }

    let found: GooglePlace | null;

    try {
      found = await picked(placeId, () => google.details(placeId, session));
    } catch (error) {
      console.error("Google Places details", error);

      return fail(c, 502, "google");
    }

    if (!found) {
      return fail(c, 422, "not-a-restaurant");
    }

    const place = await places.add({
      address: found.address,
      area: found.area,
      cuisine,
      dish,
      googlePlaceId: found.placeId,
      lat: found.lat,
      lon: found.lon,
      mapsUrl: found.mapsUrl,
      name: found.name,
      visitedOn: visitedOn || null,
    });

    if (!place) {
      return fail(c, 409, "already-added");
    }

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
