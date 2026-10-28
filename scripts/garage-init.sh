#!/bin/sh
# Gets Garage ready for the app, doing only what is not done yet, so it runs
# on every deploy: the node's place in the layout, the `photos` bucket, and
# the app's key with read and write on it.
#
# Run beside the compose file, with Garage up: `npm run storage:up` locally,
# the deploy on the server (COMPOSE_FILE=compose.prod.yaml). The key is read
# from .env, as the app reads it: S3_ACCESS_KEY_ID (GK and 24 hex
# characters) and S3_SECRET_ACCESS_KEY (64 hex characters).
set -eu

BUCKET=photos

value() {
  sed -n "s/^$1=//p" .env | tail -n 1
}

KEY_ID=$(value S3_ACCESS_KEY_ID)
KEY_SECRET=$(value S3_SECRET_ACCESS_KEY)
[ -n "$KEY_ID" ] && [ -n "$KEY_SECRET" ] || {
  echo "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set in .env"
  exit 1
}

garage() {
  docker compose exec -T garage /garage "$@"
}

if garage layout show 2>/dev/null | grep -q "No nodes currently have a role"; then
  NODE=$(garage node id -q 2>/dev/null | cut -d@ -f1)
  # The capacity only weighs nodes against each other; with one node it is
  # not a limit on what can be stored.
  garage layout assign -z paris -c 10G "$NODE"
  garage layout apply --version 1
fi

garage bucket info "$BUCKET" > /dev/null 2>&1 || garage bucket create "$BUCKET"

if ! garage key info "$KEY_ID" > /dev/null 2>&1; then
  garage key import --yes -n irma-in-paris "$KEY_ID" "$KEY_SECRET" > /dev/null
fi

garage bucket allow --read --write "$BUCKET" --key "$KEY_ID" > /dev/null
echo "Garage is ready: bucket $BUCKET, key $KEY_ID"
