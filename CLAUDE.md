# CLAUDE.md

## Git branches

Always pull before making changes: run `git fetch origin` and start from the latest `origin/main` before the first edit.

- On a branch whose PR is open, bring it up to date with `origin/main` first
- On `main`, or on a branch whose PR is already merged, create a new branch from `origin/main` instead

Always name the branch after the feature or fix it contains, never a random or generated name.

- Format: `<type>/<feature-name>` in lowercase kebab-case
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`
- Examples: `feat/photo-captions`, `fix/departure-times`, `docs/claude-md`
- If the session assigns a generic branch (for example `claude/<random-words>`), create a feature-named branch instead and push there

## Pull requests

- Never push to `main`. Every change goes in through a pull request.
- Open the PR and stop there: never merge it, not even when CI is green. Irma reviews and clicks merge.
- Deploys run on merge to `main`. Re-run a deploy only when Irma asks.

## Checks before pushing

```sh
npm run check      # Ultracite (oxlint + oxfmt); CI fails on it
npm run typecheck
npm test           # vitest
npm run build      # the site and the bundled server
```

`server/places.test.ts` runs only with `TEST_DATABASE_URL` set (after `npm run db:up`, `postgres://irma_in_paris:irma_in_paris@localhost:5435/irma_in_paris`); the Database workflow runs it in CI.

The PostToolUse hook in `.claude/hooks/ultracite.sh` runs Ultracite and the typecheck on every file you edit.

## What this is

Paris Live, at irma-in-paris.irmahs.dev: Paris right now, in three sections behind a side menu. **Météo** (`/`): the weather now, the next hours, the sun's arc and the week, from Open-Meteo. **Public transport** (`/transport`): the next metro from any stop of lines 1, 4, 6, 9 and 14, the status of those lines plus RER A, RER B and T2, from Île-de-France Mobilités' PRIM, and Vélib' bikes around the centre from its open data. **Places I've been** (`/places`): the restaurants Irma has eaten at, on a map of Paris, with photos.

A Vite + React site served by a small Hono server (`server/`), which also answers `/api`:

- The browser never calls an outside API. The server asks Open-Meteo, PRIM, Vélib' and the Géoplateforme's geocoder, parses each answer with zod as it arrives (`server/weather.ts`, `prim.ts`, `velib.ts`, `geocode.ts`), and keeps it a while (`server/cache.ts`): the weather 10 minutes, the line status 2, Vélib' 1, departures 30 seconds. The PRIM key stays on the server; without it the transport routes answer `503 no-prim-key` and the screen says live times are off.
- PRIM is reached through its Navitia API. Each line's stops are matched to PRIM's stop areas by name (`matchStops`), so the stop lists in `src/data/lines.ts` must use the names riders know; ids there are IDFM's `line:IDFM:C0xxxx`.
- Places and photo records are in Postgres (`places`, `place_photos`); the photos themselves are in **Garage**, an S3-compatible store in its own container (`server/storage.ts`, keys `photos/<id>/large.jpg` and `thumb.jpg`). Garage is only on the internal network: photos reach browsers through `GET /api/photos/:id/:size`, cached for a year since an id never changes.
- **Only admins add or remove places and photos.** Who is an admin comes only from the account service (irmahs-labs/auth), asked with the visitor's own cookie by `server/session.ts`: `GET /api/access/alma-housila` answering 204, reusing Alma Housila's `APP_ACCESS` list as Mini Games and the landing page do. Never decide who is an admin in this repo. Every change also needs this site's own `Origin`, since the cookie is shared by every `*.irmahs.dev` page.
- Photos are shrunk in the admin's browser before they are sent (`src/lib/resize.ts`: a 1600px JPEG and a 480px thumbnail). Redrawing them drops the camera's EXIF data, GPS position included; the server only takes JPEGs whose header it can read, within those sizes (`jpegSize`).
- The schema is the dbmate migrations in `db/migrations/`. Never edit a migration that is already merged: add a new one with `npm run db:new -- <name>`, with a matching `-- migrate:down`.

## Names

The name people see is `APP_NAME` in `src/lib/brand.ts`. The repo, the subdomain, the image, the network alias and the server folder are all `irma-in-paris` (`/srv/irma-in-paris`); the database and its user are `irma_in_paris`; the Garage bucket is `photos`.

## Design

The site follows the Paris Live design (a Cute Matcha canvas) in Cute Matcha's app look, in Light Matcha and Dark Matcha. Colours are the system's role tokens at the top of `src/styles.css` (Light Matcha on `:root`, Dark Matcha on `:root[data-theme="dark"]`), picked by job, never by hex: page `ground`, cards `panel`, controls `raised`, the chosen item `strong` (menu entry, stop, filter), text on a window's matcha body `on-accent`. `moss`, `gold`, `terracotta`, `danger`, `cream`, `ink` and `water` are fixed drawing colours: the window buttons, the UV and air scales, the sky icons, the Seine. Line colours are each line's own, with the ink that reads on them, in `src/data/lines.ts`.

Every page opens with the **Header** (`src/components/header.tsx`): the train icon (`src/components/app-icon.tsx`, the same drawing as `public/favicon.svg`), the name in Fredoka with "by Irma HS" under it, Paris's date and time, the theme toggle and the account pill. Content sits in **windows** (`src/components/app-window.tsx`): a matcha body with the hard shadow under a dark title bar with a 6px grid, a file name with an extension that exists (`weather.app`, `next_metro.exe`, `velib.map`) and the three window buttons. Inside, **tiles** are flat `panel` cards. The maps (`src/components/paris-map.tsx`) draw only the Seine; pins are placed as a share of the map's width and height from `src/lib/map.ts`. Every page closes with the sources line and the **Footer**: "Paris Live by Irma HS", her name linking to irmahs.dev.

## Deploy

Merging to `main` runs `.github/workflows/deploy.yml`, which SSHes to the server as `deploy`, resets `/srv/irma-in-paris` to `main`, writes `.env` from the secrets, and with `compose.prod.yaml` starts Postgres and Garage, runs `scripts/garage-init.sh` (layout, bucket and key, each only once), builds the app, runs pending migrations and swaps the app's container. The shared Caddy in irmahs-labs/proxy routes `irma-in-paris.irmahs.dev` to it. `compose.yaml` is for local development only. The secrets are listed in README.md.
