#!/bin/sh
# Cuts Paris out of Protomaps' daily OpenStreetMap build into
# maps/paris.pmtiles, the one file the app's map is drawn from (about 45 MB).
# Only when there is none yet, or it is over 30 days old, so it runs on every
# deploy and costs nothing most days. Locally: `npm run map:fetch`.
#
# The `map` service in the compose file is go-pmtiles. The file is written
# beside it as paris.pmtiles.new and then renamed, so the app never reads a
# half-written map.
set -eu

FILE=maps/paris.pmtiles
# Paris inside the Périphérique, and a little past it.
BBOX=2.20,48.79,2.50,48.92

mkdir -p maps

if [ -s "$FILE" ] && [ -z "$(find "$FILE" -mtime +30)" ]; then
  echo "The map is up to date"
  exit 0
fi

day() {
  date -u -d "-$1 day" +%Y%m%d 2>/dev/null || date -u -v-"$1"d +%Y%m%d
}

# Protomaps keeps the last few daily builds; the newest may not be out yet.
for back in 0 1 2 3 4 5 6; do
  BUILD="https://build.protomaps.com/$(day "$back").pmtiles"

  if curl -sfI "$BUILD" > /dev/null; then
    docker compose run --rm --user "$(id -u):$(id -g)" map \
      extract "$BUILD" /maps/paris.pmtiles.new --bbox="$BBOX" --maxzoom=16
    mv maps/paris.pmtiles.new "$FILE"
    echo "The map is from $BUILD"
    exit 0
  fi
done

echo "No Protomaps build found in the last week"
[ -s "$FILE" ]
