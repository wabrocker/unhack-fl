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
cp data/fl-counties.json dist/data/
cp api/index.php api/.htaccess dist/api/

# Short content hash per asset — changes only when the file changes.
hash_of() { shasum -a 256 "$1" | cut -c1-8; }
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

echo "built dist/  css=${CSS_HASH}  js=${JS_HASH}"

if [[ "${1:-}" == "--deploy" ]]; then
  echo "deploying to ${REMOTE_HOST}:~/${REMOTE_DIR}/"
  rsync -az --no-perms --omit-dir-times \
    -e "ssh -o BatchMode=yes" dist/ "${REMOTE_HOST}:~/${REMOTE_DIR}/"
  echo "deployed. verifying what the CDN serves:"
  sleep 2
  curl -s --max-time 20 "https://fl.unhackdemocracy.us/app.js?v=${JS_HASH}" \
    | grep -c buildLetter | sed 's/^/  buildLetter in served app.js: /'
fi
