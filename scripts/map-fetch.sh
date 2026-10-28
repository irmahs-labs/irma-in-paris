#!/bin/sh
# Cuts the app's two maps out of Protomaps' daily OpenStreetMap build:
# maps/paris.pmtiles, Paris down to its streets (about 45 MB), and
# maps/idf.pmtiles, Île-de-France down to its towns and main roads (about
# 30 MB). Each only when there is none yet, or it is over 30 days old, so it
# runs on every deploy and costs nothing most days. Locally: `npm run map:fetch`.
#
# The `map` service in the compose file is go-pmtiles. A file is written
# beside it as <name>.pmtiles.new and then renamed, so the app never reads a
# half-written map.
set -eu

mkdir -p maps

day() {
  date -u -d "-$1 day" +%Y%m%d 2>/dev/null || date -u -v-"$1"d +%Y%m%d
}

# Protomaps keeps the last few daily builds; the newest may not be out yet.
build() {
  for back in 0 1 2 3 4 5 6; do
    url="https://build.protomaps.com/$(day "$back").pmtiles"

    if curl -sfI "$url" > /dev/null; then
      echo "$url"
      return 0
    fi
  done

  return 1
}

# fetch <name> <bbox> <maxzoom>
fetch() {
  file="maps/$1.pmtiles"

  if [ -s "$file" ] && [ -z "$(find "$file" -mtime +30)" ]; then
    echo "The $1 map is up to date"
    return 0
  fi

  if ! url=$(build); then
    echo "No Protomaps build found in the last week"
    [ -s "$file" ]
    return
  fi

  docker compose run --rm --user "$(id -u):$(id -g)" map \
    extract "$url" "/maps/$1.pmtiles.new" --bbox="$2" --maxzoom="$3"
  mv "maps/$1.pmtiles.new" "$file"
  echo "The $1 map is from $url"
}

# Paris inside the Périphérique, and a little past it.
fetch paris 2.20,48.79,2.50,48.92 16
# Île-de-France, its eight departments and a little past them.
fetch idf 1.40,48.10,3.60,49.25 12
