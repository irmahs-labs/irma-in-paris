import { randomUUID } from "node:crypto";
import path from "node:path";

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as z from "zod/mini";

import { isCuisine } from "../src/data/cuisines";
import { LINES } from "../src/data/lines";
import type {
  ApiError,
  BusLine,
  Departures,
  Direction,
  DirectionId,
  LinesReport,
  NearbyStop,
  Me,
  Stop,
  PickedPlace,
  RegionReport,
  Place,
  TrafficReport,
  Trip,
  Trips,
  VelibReport,
  WeatherReport,
} from "../src/lib/api";
import { createCache } from "./cache";
import { GoogleKeyRefusedError } from "./google-places";
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
  /** The weather and air at every town on the Île-de-France map. */
  region: () => Promise<RegionReport>;
  /** Around the centre, or the stations nearest a point. */
  velib: (near?: { lat: number; lon: number }) => Promise<VelibReport>;
  /** Null without a PRIM key: the transport routes then say so. */
  prim: Prim | null;
  /** Null without a Google Maps key: adding places then says so. */
  google: GooglePlaces | null;
  storage: Storage;
  /** The folder the PMTiles maps are in: paris.pmtiles and idf.pmtiles. */
  mapDir: string;
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

/** The map files there are. */
const MAP_FILES = ["paris.pmtiles", "idf.pmtiles"] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DAY = 24 * 60 * 60_000;

/** A bus line as PRIM names it, "line:IDFM:C01107". */
const BUS_LINE = /^line:IDFM:C\d{5}$/u;

/** What a rider types to find a bus: its number, "72", "N01", "TVM". */
const BUS_QUERY = /^[0-9A-Z]{1,6}$/u;

/** Île-de-France, roughly: a point outside it is not looked up. */
const REGION = { east: 3.6, north: 49.3, south: 48.1, west: 1.4 };

/**
 * The rider's position from `?lat=&lon=`, rounded to about a hundred
 * metres: enough to find the stops near them, and all that leaves this
 * server. Null when it is not a point in Île-de-France.
 */
export const pointOf = (lat: string | undefined, lon: string | undefined) => {
  const y = Number(lat);
  const x = Number(lon);

  if (
    !(lat && lon && Number.isFinite(y) && Number.isFinite(x)) ||
    y < REGION.south ||
    y > REGION.north ||
    x < REGION.west ||
    x > REGION.east
  ) {
    return null;
  }

  return { lat: Math.round(y * 1000) / 1000, lon: Math.round(x * 1000) / 1000 };
};

/** "inbound" or "outbound" from a `?direction=`; undefined when it is neither. */
const wayOf = (value: string | undefined): DirectionId | undefined =>
  value === "inbound" || value === "outbound" ? value : undefined;

const PLACE_ID = /^\d{1,18}$/u;

const PHOTO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** A phone photo shrunk to 1600px by the page is well under this. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_SIDE = { large: 2048, thumb: 640 } as const;

const fail = (
  c: Context,
  status: 400 | 403 | 404 | 409 | 422 | 429 | 503,
  error: string
) => c.json({ error } satisfies ApiError, status);

/**
 * An outside API that did not answer as it should. 503, not 502: Cloudflare,
 * in front of the site, swaps an origin's 502 for its own "error code: 502"
 * text, and the page would lose the reason.
 */
const upstreamFailed = (c: Context, error: string) => fail(c, 503, error);

/**
 * What to tell the admin when Google said no: "google-key" when it refused
 * the key itself, which only fixing the key in Google Cloud mends.
 */
const googleReason = (keyRefused: boolean) =>
  keyRefused ? "google-key" : "google";

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
  region,
  velib,
  prim,
  google,
  mapDir,
  storage,
  places,
  newId = randomUUID,
}: AppOptions) => {
  const app = new Hono<{ Variables: Variables }>();
  const weatherCache = createCache<WeatherReport>({ ttlMs: 10 * 60_000 });
  const regionCache = createCache<RegionReport>({ ttlMs: 15 * 60_000 });
  const velibCache = createCache<VelibReport>({ ttlMs: 60_000 });
  const trafficCache = createCache<TrafficReport>({ ttlMs: 2 * 60_000 });

  const departuresCache = createCache<Departures>({
    staleMs: 0,
    ttlMs: 30_000,
  });

  const linesCache = createCache<PrimLine[]>({ ttlMs: DAY });
  const stopsCache = createCache<Stop[]>({ ttlMs: DAY });
  const towardsCache = createCache<Stop[]>({ ttlMs: DAY });
  const directionsCache = createCache<Direction[]>({ ttlMs: DAY });
  const busCache = createCache<BusLine | null>({ ttlMs: DAY });
  const busSearchCache = createCache<BusLine[]>({ ttlMs: DAY });
  const tripsCache = createCache<Trip[]>({ staleMs: 0, ttlMs: 30_000 });
  const nearCache = createCache<NearbyStop[]>({ staleMs: 0, ttlMs: 30_000 });

  app.onError((thrown, c) => {
    console.error(thrown);

    return c.json({ error: "server" } satisfies ApiError, 500);
  });

  app.get("/healthz", (c) => c.text("ok"));

  app.on(["GET", "HEAD"], "/tiles/:file", async (c) => {
    const asked = c.req.param("file");
    // The path is built from the app's own list, never from the request.
    const file = MAP_FILES.find((name) => name === asked);

    if (!file) {
      return fail(c, 404, "map");
    }

    return await serveRanges(path.join(mapDir, file), c.req.raw);
  });

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

      return upstreamFailed(c, "weather");
    }
  });

  app.get("/api/region", async (c) => {
    try {
      return c.json(await regionCache("idf", region));
    } catch (error) {
      console.error("Île-de-France weather", error);

      return upstreamFailed(c, "region");
    }
  });

  app.get("/api/velib", async (c) => {
    const asked = c.req.query("lat") ?? c.req.query("lon");
    const point = pointOf(c.req.query("lat"), c.req.query("lon"));

    if (asked && !point) {
      return fail(c, 400, "where");
    }

    try {
      return c.json(
        await velibCache(point ? `${point.lat},${point.lon}` : "central", () =>
          velib(point ?? undefined)
        )
      );
    } catch (error) {
      console.error("Vélib'", error);

      return upstreamFailed(c, "velib");
    }
  });

  /** PRIM's lines, asked once a day: they change with the timetable, not the hour. */
  const linesOf = (live: Prim) => linesCache("all", () => live.lines());

  /** The line a `?line=` names, from PRIM's own list; null when there is none. */
  const lineAt = async (live: Prim, key: string | undefined) => {
    const lines = await linesOf(live);

    return lines.find((line) => line.key === key) ?? null;
  };

  /**
   * PRIM's id for the line a `?line=` names: a metro, RER, tram or
   * Transilien line by its key, or a bus line by PRIM's own id, once PRIM
   * says it is a bus. Null for anything else.
   */
  const primIdOf = async (live: Prim, key: string | undefined) => {
    if (key && BUS_LINE.test(key)) {
      const bus = await busCache(key, () => live.busLine(key));

      return bus?.id ?? null;
    }

    const line = await lineAt(live, key);

    return line?.prim ?? null;
  };

  const stopsOf = (live: Prim, lineId: string) =>
    stopsCache(lineId, () => live.stops(lineId));

  /** Whether a stop is on a line, as PRIM lists the line's stops. */
  const isOnLine = async (live: Prim, lineId: string, stopId: string) => {
    const stops = await stopsOf(live, lineId);

    return stops.some((stop) => stop.id === stopId);
  };

  /**
   * Runs a PRIM answer: 503 without the key, and when PRIM fails, the
   * failure logged and a 503 the page can read.
   */
  const fromPrim = async (
    c: Context,
    what: string,
    answer: (live: Prim) => Promise<Response>
  ) => {
    if (!prim) {
      return fail(c, 503, "no-prim-key");
    }

    try {
      return await answer(prim);
    } catch (error) {
      console.error(`PRIM ${what}`, error);

      return upstreamFailed(c, "prim");
    }
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

  app.get("/api/transport/directions", (c) =>
    fromPrim(c, "directions", async (live) => {
      const lineId = await primIdOf(live, c.req.query("line"));

      if (!lineId) {
        return fail(c, 400, "line");
      }

      return c.json(
        await directionsCache(lineId, () => live.directions(lineId))
      );
    })
  );

  /** A line's stops: in the order trains call at them one way, or all of them by name. */
  app.get("/api/transport/stops", (c) =>
    fromPrim(c, "stops", async (live) => {
      const lineId = await primIdOf(live, c.req.query("line"));
      const asked = c.req.query("direction");
      const way = wayOf(asked);

      if (!lineId || (asked && !way)) {
        return fail(c, 400, "line");
      }

      return c.json(
        way
          ? await towardsCache(`${lineId}|${way}`, () =>
              live.stopsTowards(lineId, way)
            )
          : await stopsOf(live, lineId)
      );
    })
  );

  app.get("/api/transport/status", (c) =>
    fromPrim(c, "line status", async (live) =>
      c.json(
        await trafficCache("all", async () => ({
          lines: await live.statuses(await linesOf(live)),
          updatedAt: new Date().toISOString(),
        }))
      )
    )
  );

  app.get("/api/transport/departures", (c) =>
    fromPrim(c, "departures", async (live) => {
      const lineId = await primIdOf(live, c.req.query("line"));
      const stopId = c.req.query("stop") ?? "";
      const asked = c.req.query("direction");
      const way = wayOf(asked);

      // Only a stop on that line, as PRIM lists it: nothing else is asked of PRIM.
      if (
        !(lineId && (await isOnLine(live, lineId, stopId))) ||
        (asked && !way)
      ) {
        return fail(c, 400, "stop");
      }

      return c.json(
        await departuresCache(`${lineId}|${stopId}|${way ?? ""}`, () =>
          live.departures(lineId, stopId, way)
        )
      );
    })
  );

  /** The next trains from one stop of a line that call at another. */
  app.get("/api/transport/trips", (c) =>
    fromPrim(c, "trips", async (live) => {
      const lineId = await primIdOf(live, c.req.query("line"));
      const from = c.req.query("from") ?? "";
      const to = c.req.query("to") ?? "";

      if (
        !(
          lineId &&
          from !== to &&
          (await isOnLine(live, lineId, from)) &&
          (await isOnLine(live, lineId, to))
        )
      ) {
        return fail(c, 400, "stop");
      }

      return c.json({
        trips: await tripsCache(`${lineId}|${from}|${to}`, () =>
          live.trips(lineId, from, to)
        ),
      } satisfies Trips);
    })
  );

  /** Bus lines by their number: "72", "N01". */
  app.get("/api/transport/buses", (c) =>
    fromPrim(c, "bus search", async (live) => {
      const query = (c.req.query("q") ?? "").trim().toUpperCase();

      if (!BUS_QUERY.test(query)) {
        return fail(c, 400, "search");
      }

      return c.json(await busSearchCache(query, () => live.searchBuses(query)));
    })
  );

  /** The bus stops nearest the rider, with what leaves each soonest. */
  app.get("/api/transport/near", (c) =>
    fromPrim(c, "nearby buses", async (live) => {
      const point = pointOf(c.req.query("lat"), c.req.query("lon"));

      if (!point) {
        return fail(c, 400, "where");
      }

      return c.json(
        await nearCache(`${point.lat},${point.lon}`, () =>
          live.busesNear(point.lat, point.lon)
        )
      );
    })
  );

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

      return upstreamFailed(
        c,
        googleReason(error instanceof GoogleKeyRefusedError)
      );
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

      return upstreamFailed(
        c,
        googleReason(error instanceof GoogleKeyRefusedError)
      );
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

      return upstreamFailed(
        c,
        googleReason(error instanceof GoogleKeyRefusedError)
      );
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
