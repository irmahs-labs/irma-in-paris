import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";

// Add the presets the app needs: `ultracite/oxlint/react` for React, and
// `ultracite/oxlint/next` too for Next.js (landing-page shows both).
export default defineConfig({
  extends: [core, antiSlop],
  ignorePatterns: core.ignorePatterns,
});
