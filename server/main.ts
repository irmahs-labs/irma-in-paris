import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { createApp } from "./app";
import { connect } from "./db";
import { env } from "./env";
import { createGooglePlaces } from "./google-places";
import {
  addPhoto,
  addPlace,
  photoExists,
  readPlaces,
  removePhoto,
  removePlace,
} from "./places";
import { createPrim } from "./prim";
import { askAccountService } from "./session";
import { createStorage } from "./storage";
import { fetchVelib } from "./velib";
import { fetchWeather } from "./weather";

const pool = connect(env.databaseUrl);

if (!env.googleMapsApiKey) {
  console.warn("GOOGLE_MAPS_API_KEY is not set: places cannot be added");
}

if (!env.primApiKey) {
  console.warn("PRIM_API_KEY is not set: live transport times are off");
}

const app = createApp({
  appOrigin: env.appOrigin,
  google: env.googleMapsApiKey
    ? createGooglePlaces({ apiKey: env.googleMapsApiKey })
    : null,
  mapFile: env.mapFile,
  places: {
    add: (place) => addPlace(pool, place),
    addPhoto: (photo) => addPhoto(pool, photo),
    photoExists: (id) => photoExists(pool, id),
    read: () => readPlaces(pool),
    remove: (id) => removePlace(pool, id),
    removePhoto: (id) => removePhoto(pool, id),
  },
  prim: env.primApiKey ? createPrim({ apiKey: env.primApiKey }) : null,
  storage: createStorage(env.s3),
  velib: () => fetchVelib(),
  weather: () => fetchWeather(),
  whoIs: askAccountService(env.authUrl),
});

// Production: the built site from the same origin as /api, so the session
// cookie and every request stay first-party. Any path that is not a file is
// a page of the app, which routes it itself.
if (env.staticDir) {
  const root = env.staticDir;

  app.use("/assets/*", (c, next) => {
    // Vite names every built asset after its contents, so a cached copy is never stale.
    c.header("cache-control", "public, max-age=31536000, immutable");

    return next();
  });
  app.use("*", (c, next) => {
    // The page itself is always checked, so a deploy shows at once.
    if (!c.req.path.startsWith("/assets/") && !c.req.path.startsWith("/api/")) {
      c.header("cache-control", "no-cache");
    }

    return next();
  });
  app.use("*", serveStatic({ root }));
  app.get("*", serveStatic({ path: "index.html", root }));
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`irma-in-paris listening on :${info.port}`);
});
