#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_IPA="$(find "$ROOT_DIR/build/app-store/export" -maxdepth 1 -name '*.ipa' -print -quit 2>/dev/null || true)"
IPA_PATH="${1:-$DEFAULT_IPA}"

# Load .env file if present (to pick up APP_STORE_CONNECT_P8_FILE and other credentials)
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "$IPA_PATH" || ! -f "$IPA_PATH" ]]; then
  echo "IPA not found. Pass the .ipa path explicitly or run the build script first." >&2
  exit 1
fi

ALTOOL_ARGS=(
  --upload-app
  -f "$IPA_PATH"
  --output-format json
  --show-progress
)

if [[ -n "${APP_STORE_CONNECT_API_KEY:-}" && -n "${APP_STORE_CONNECT_ISSUER_ID:-}" ]]; then
  ALTOOL_ARGS+=(--apiKey "$APP_STORE_CONNECT_API_KEY" --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID")

  if [[ -n "${APP_STORE_CONNECT_P8_FILE:-}" ]]; then
    ALTOOL_ARGS+=(--p8-file-path "$APP_STORE_CONNECT_P8_FILE")
  fi
elif [[ -n "${APP_STORE_CONNECT_USERNAME:-}" && -n "${APP_STORE_CONNECT_PASSWORD:-}" ]]; then
  ALTOOL_ARGS+=(--username "$APP_STORE_CONNECT_USERNAME" --password "@env:APP_STORE_CONNECT_PASSWORD")
else
  cat >&2 <<'EOF'
Missing App Store Connect credentials.

Set one of:
  APP_STORE_CONNECT_API_KEY
  APP_STORE_CONNECT_ISSUER_ID
Optional with API key auth:
  APP_STORE_CONNECT_P8_FILE

Or:
  APP_STORE_CONNECT_USERNAME
  APP_STORE_CONNECT_PASSWORD
EOF
  exit 1
fi

xcrun altool "${ALTOOL_ARGS[@]}"
