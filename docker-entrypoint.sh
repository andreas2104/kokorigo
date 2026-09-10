#!/bin/sh
set -eu

dotnet /app/api/EpubLibrary.dll &
api_pid=$!

node /app/web/server.js &
web_pid=$!

caddy run --config /app/Caddyfile --adapter caddyfile &
caddy_pid=$!

cleanup() {
  trap - INT TERM EXIT
  kill "$caddy_pid" "$web_pid" "$api_pid" 2>/dev/null || true
  wait "$caddy_pid" "$web_pid" "$api_pid" 2>/dev/null || true
}

shutdown() {
  cleanup
  exit 0
}

trap shutdown INT TERM
trap cleanup EXIT

while kill -0 "$api_pid" 2>/dev/null \
  && kill -0 "$web_pid" 2>/dev/null \
  && kill -0 "$caddy_pid" 2>/dev/null; do
  sleep 1
done

echo "Un service interne s'est arrêté de façon inattendue." >&2
exit 1
