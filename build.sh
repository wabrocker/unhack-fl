#!/usr/bin/env bash
# Build dist/ — the exact contents of the subdomain document root.
#
# Stamps a content hash onto the CSS and JS URLs in index.html, so every
# deploy produces new URLs for changed files. Paired with the cache rules
# in web/.htaccess, that removes the need to purge Hostinger's CDN by hand
# (which we forgot once already, and spent a while confused).
#
#   ./build.sh            build dist/ and the zip
#   ./build.sh --deploy   build, then rsync to the server over SSH
#
set -euo pipefail
cd "$(dirname "$0")"

REMOTE_HOST="hostinger"
REMOTE_DIR="domains/unhackdemocracy.us/public_html/fl"

rm -rf dist unhack-fl-deploy.zip
mkdir -p dist/data dist/api

cp web/index.html web/styles.css web/app.js dist/
cp web/.htaccess dist/.htaccess
cp data/*.json dist/data/   # copies every data file, not just the ones known when this line was written
cp api/index.php api/.htaccess dist/api/

# Short content hash per asset — changes only when the file changes.
hash_of() { shasum -a 256 "$1" | cut -c1-8; }

# Data files aren't hashed into their own filenames, so a browser or CDN
# that already cached one under an older response keeps that copy for its
# original lifetime — a server-side Cache-Control change alone doesn't
# reach caches that already have a copy. Stamp a version query string onto
# the fetch() URLs instead, computed from the data files' own content, so
# a data change becomes a new URL and old cached copies stop mattering —
# the same trick already used for CSS and JS below. This runs BEFORE the
# JS hash so a data-only change naturally changes app.js's hash too.
DATA_HASH=$(cat dist/data/*.json | shasum -a 256 | cut -c1-8)
sed -i '' \
  -e "s|\"\.\./data/fl-counties\.json\"|\"../data/fl-counties.json?v=${DATA_HASH}\"|" \
  -e "s|\"\.\./data/topic-starters\.json\"|\"../data/topic-starters.json?v=${DATA_HASH}\"|" \
  -e "s|\"\.\./data/sheriffs\.json\"|\"../data/sheriffs.json?v=${DATA_HASH}\"|" \
  dist/app.js

for f in fl-counties topic-starters sheriffs; do
  grep -q "${f}.json?v=${DATA_HASH}" dist/app.js || { echo "FAIL: ${f}.json not stamped"; exit 1; }
done

JS_HASH=$(hash_of dist/app.js)
CSS_HASH=$(hash_of dist/styles.css)

# BSD sed (macOS) needs the empty -i argument; this script assumes macOS.
sed -i '' \
  -e "s|href=\"styles\.css\"|href=\"styles.css?v=${CSS_HASH}\"|" \
  -e "s|src=\"app\.js\"|src=\"app.js?v=${JS_HASH}\"|" \
  dist/index.html

grep -q "styles.css?v=${CSS_HASH}" dist/index.html || { echo "FAIL: css not stamped"; exit 1; }
grep -q "app.js?v=${JS_HASH}"      dist/index.html || { echo "FAIL: js not stamped"; exit 1; }

( cd dist && zip -qr ../unhack-fl-deploy.zip . -x ".DS_Store" )

echo "built dist/  css=${CSS_HASH}  js=${JS_HASH}  data=${DATA_HASH}"

if [[ "${1:-}" == "--deploy" ]]; then
  echo "deploying to ${REMOTE_HOST}:~/${REMOTE_DIR}/"
  rsync -az --no-perms --omit-dir-times \
    -e "ssh -o BatchMode=yes" dist/ "${REMOTE_HOST}:~/${REMOTE_DIR}/"
  echo "deployed. verifying what the CDN serves:"
  sleep 2
  curl -s --max-time 20 "https://fl.unhackdemocracy.us/app.js?v=${JS_HASH}" \
    | grep -c buildLetter | sed 's/^/  buildLetter in served app.js: /'
fi
