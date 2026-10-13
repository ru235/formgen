#!/bin/sh
# Build the browser bundle from the engine + web UI. Uses a local esbuild
# binary (no network install) and Node's native TS type stripping for tests.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ESBUILD=""
for c in \
  "$HOME/service555/node_modules/.bin/esbuild" \
  "$HOME/format-astro/node_modules/.bin/esbuild" \
  "$ROOT/node_modules/.bin/esbuild"
do
  [ -x "$c" ] && ESBUILD="$c" && break
done
if [ -z "$ESBUILD" ]; then
  echo "esbuild not found; run: npm i -D esbuild" >&2
  exit 1
fi
"$ESBUILD" "$ROOT/web/src/app.ts" \
  --bundle \
  --format=iife \
  --target=es2020 \
  --charset=utf8 \
  --outfile="$ROOT/web/dist/app.js"
echo "built web/dist/app.js"