#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/deploy-host.sh <archive.tar.gz|archive.zip> [--delete-archive]"
  exit 1
fi

ARCHIVE="$1"
DELETE_ARCHIVE="${2:-}"
APP_DIR="${APP_DIR:-$(pwd)}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/unqx-deploy.XXXXXX")"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ ! -f "$ARCHIVE" ]]; then
  echo "[deploy] archive not found: $ARCHIVE"
  exit 1
fi

echo "[deploy] extracting archive to $TMP_DIR"
case "$ARCHIVE" in
  *.tar.gz|*.tgz)
    tar -xzf "$ARCHIVE" -C "$TMP_DIR"
    ;;
  *.zip)
    if ! command -v unzip >/dev/null 2>&1; then
      echo "[deploy] unzip not found. Install it or use tar.gz package."
      exit 1
    fi
    unzip -q "$ARCHIVE" -d "$TMP_DIR"
    ;;
  *)
    echo "[deploy] unsupported archive format: $ARCHIVE"
    exit 1
    ;;
esac

if [[ ! -f "$TMP_DIR/.next/standalone/server.js" ]]; then
  echo "[deploy] invalid package: .next/standalone/server.js not found"
  exit 1
fi

if [[ ! -f "$TMP_DIR/server-launcher.cjs" ]]; then
  echo "[deploy] invalid package: server-launcher.cjs not found"
  exit 1
fi

echo "[deploy] replacing standalone bundle"
mkdir -p "$APP_DIR/.next"
rm -rf "$APP_DIR/.next/standalone.new"
cp -a "$TMP_DIR/.next/standalone" "$APP_DIR/.next/standalone.new"

if [[ -f "$APP_DIR/.env" && ! -f "$APP_DIR/.next/standalone.new/.env" ]]; then
  cp "$APP_DIR/.env" "$APP_DIR/.next/standalone.new/.env"
fi

rm -rf "$APP_DIR/.next/standalone.prev"
if [[ -d "$APP_DIR/.next/standalone" ]]; then
  mv "$APP_DIR/.next/standalone" "$APP_DIR/.next/standalone.prev"
fi
mv "$APP_DIR/.next/standalone.new" "$APP_DIR/.next/standalone"

cp "$TMP_DIR/server-launcher.cjs" "$APP_DIR/server-launcher.cjs"

if [[ "${KEEP_PREVIOUS_STANDALONE:-0}" != "1" ]]; then
  rm -rf "$APP_DIR/.next/standalone.prev"
fi

if [[ "$DELETE_ARCHIVE" == "--delete-archive" ]]; then
  rm -f "$ARCHIVE"
fi

echo "[deploy] done"
echo "[deploy] restart application from hosting panel if it does not auto-restart"

