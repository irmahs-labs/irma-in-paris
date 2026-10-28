import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { APP_NAME } from "./src/lib/brand.ts";

export default defineConfig({
  plugins: [
    react(),
    // The tab title comes from the same constant as the in-app name, written
    // into the HTML itself so it is right before any script runs.
    {
      name: "app-name",
      transformIndexHtml: {
        handler: (html) => html.replaceAll("%APP_NAME%", APP_NAME),
        order: "pre",
      },
    },
  ],
  server: {
    // `npm run dev:api` serves /api on 3002; the browser only ever sees 5173,
    // so the session cookie and every request stay same-origin, as in
    // production.
    proxy: {
      "/api": "http://localhost:3002",
      "/tiles": "http://localhost:3002",
    },
  },
  test: {
    environment: "node",
  },
});
