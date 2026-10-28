# Irma in Paris

Paris right now, at **https://irma-in-paris.irmahs.dev**: the weather, the next train on every metro, RER and Transilien line, Vélib' bikes and line status, and the restaurants I've eaten at, on a map, with photos.

| Section | Path | From |
| --- | --- | --- |
| Weather | `/` | [Open-Meteo](https://open-meteo.com) (no key) |
| Public transport | `/transport` | [PRIM](https://prim.iledefrance-mobilites.fr), Île-de-France Mobilités (key), and [Vélib' Métropole open data](https://www.velib-metropole.fr/donnees-open-data-gbfs-du-service-velib-metropole) (no key) |
| Places I've been | `/places` | This app's Postgres, photos in Garage; restaurants picked from [Google Maps' Places API](https://developers.google.com/maps/documentation/places/web-service) (key) |

The maps are [Protomaps](https://protomaps.com)' OpenStreetMap basemap, drawn by [MapLibre](https://maplibre.org) in Light and Dark Matcha from one file the app serves itself: no map service is asked anything.

Anyone can look. Only admins can add or remove places and photos: whoever the account service lists for `alma-housila` in its `APP_ACCESS` secret (irmahs-labs/auth), the same list Mini Games and the landing page use.

Built with Vite, React 19 and Hono on Node 24, Postgres 17 with dbmate, Garage for the photos, and MapLibre with PMTiles for the maps. Styled in Cute Matcha's app look, in Light and Dark Matcha.

## The PRIM key

- **On the server:** GitHub → this repo → Settings → Secrets and variables → Actions → New repository secret, named **`PRIM_API_KEY`**. The deploy writes it to `.env` on the server; it never reaches the browser. Re-run the deploy (Actions → Deploy → Run workflow) after adding or changing it.
- **Locally:** the `PRIM_API_KEY=` line in `.env` (copied from `.env.example`, ignored by git).

Without it everything else works, and the transport screen says live times are off.

## The Google Maps key

Adding a restaurant means searching for it by name and picking it from Google Maps, so only real restaurants go on the map. The key stays on the server.

1. [Google Cloud console](https://console.cloud.google.com) → the **irmahs-hub** project → APIs & Services → Library → **Places API (New)** → Enable. It needs a billing account; searching and picking a few restaurants a month stays inside Google's free monthly allowance.
2. APIs & Services → Credentials → Create credentials → API key. Under _API restrictions_, allow only **Places API (New)**.
3. Add it as the repository secret **`GOOGLE_MAPS_API_KEY`**, and locally on the `GOOGLE_MAPS_API_KEY=` line in `.env`.

Without it the places still show; the add form says it needs the key.

## Local development

Needs Node 22.18+ and Docker.

```bash
cp .env.example .env     # add your PRIM key to it
npm install
npm run db:up            # Postgres on localhost:5435, migrations applied
npm run storage:up       # Garage on localhost:3900, with the photos bucket and key
npm run map:fetch        # the map of Paris into maps/ (about 45 MB, once)
npm run dev:api          # the server on :3002
npm run dev              # the site on http://localhost:5173
```

Sign-in goes through the account service, which does not answer `localhost` from `auth.irmahs.dev`; run irmahs-labs/auth locally on `:3001` (and set `VITE_AUTH_URL=http://localhost:3001`) to sign in as an admin.

```bash
npm test                 # vitest; add TEST_DATABASE_URL to run the Postgres tests too
npm run check            # Ultracite, as CI runs it
```

## Why Garage for the photos, not SeaweedFS

Both are self-hosted, S3-compatible object stores. For one small server holding a few hundred photos, Garage fits better:

- **One process, one config file.** Garage is a single Rust binary in a small image; one container on the internal network, two volumes, done. SeaweedFS is built from a master, volume servers, a filer and an S3 gateway: more containers and more to keep running for the same job.
- **Light on the server.** Garage was designed for small machines and idles at a few tens of MB of memory, next to the other apps on the same Hetzner box. SeaweedFS's strengths (billions of small files, erasure coding, tiering to cloud storage, FUSE mounts) are for far more data than this.
- **The S3 the app needs, and nothing else to learn.** The app only puts, gets and deletes objects with signed requests, which Garage does fully. What Garage leaves out (ACLs, bucket policies, versioning) the app does not use: photos are private to the internal network and served by the app itself.
- **Scripted setup.** Garage's CLI imports a key from values we choose, so `scripts/garage-init.sh` sets up the layout, the bucket and the app's key from the GitHub secrets on every deploy, doing only what is missing. Nothing to click or copy by hand.

If the photos ever outgrow one disk, Garage adds nodes (another server, even another site) with the same setup; that is what it was built for.

## Deploying

Pushing to `main` deploys to `/srv/irma-in-paris`: Postgres and Garage start, Garage gets its bucket and key, the map of Paris is cut from Protomaps' daily build if there is none or it is over a month old (`scripts/map-fetch.sh`, into `/srv/irma-in-paris/maps`), pending migrations run, then the app is rebuilt and started on the `proxy` network as `irma-in-paris`. irmahs-labs/proxy routes `irma-in-paris.irmahs.dev` to it.

### First time

1. On the server, as the admin user: `sudo mkdir /srv/irma-in-paris && sudo chown deploy:deploy /srv/irma-in-paris`.
2. The repo secrets below.
3. Merge to `main`; the deploy runs.
4. Merge the Caddyfile block in irmahs-labs/proxy. Cloudflare's `A` and `AAAA` records for `irma-in-paris` are already in place.

### Secrets

Settings → Secrets and variables → Actions:

| Secret | What | Make one with |
| --- | --- | --- |
| `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST` | Organisation level, shared with the other repos |  |
| `IRMA_IN_PARIS_POSTGRES_PASSWORD` | The database's password. Read only when the database is first created | `openssl rand -base64 32` |
| `IRMA_IN_PARIS_GARAGE_RPC_SECRET` | Garage's own secret between its processes. Must be 64 hex characters | `openssl rand -hex 32` |
| `IRMA_IN_PARIS_S3_SECRET_KEY` | The app's Garage secret key. Must be 64 hex characters. Its key id is in `deploy.yml`, as it is not secret | `openssl rand -hex 32` |
| `PRIM_API_KEY` | Optional. The PRIM key, see above | From PRIM |
| `GOOGLE_MAPS_API_KEY` | Optional. For adding restaurants, see above | From Google Cloud |

Change `IRMA_IN_PARIS_S3_SECRET_KEY` after the first deploy and Garage keeps the old one: delete the key on the server (`docker compose -f compose.prod.yaml exec garage /garage key delete --yes <key id>`) and redeploy to import the new one.

### Backups

The places are in the `db_data` volume, the photos in `garage_data` (with Garage's metadata in `garage_meta`, snapshotted every 6 hours inside it). Back up all three together.
