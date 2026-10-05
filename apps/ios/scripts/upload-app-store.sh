#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--" ]]; then
  shift
fi
OPERATION="--upload-app"
if [[ "${1:-}" == "--validate" ]]; then
  OPERATION="--validate-app"
  shift
fi
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

# An earlier release export can still exist if today's archive has not run.
INFO_ENTRY="$(unzip -Z1 "$IPA_PATH" | awk '/^Payload\/[^\/]+\.app\/Info.plist$/ && !found { print; found = 1 }')"
if [[ -z "$INFO_ENTRY" ]]; then
  echo "IPA has no application Info.plist." >&2
  exit 1
fi
INFO_PLIST="$(mktemp)"
trap 'rm -f "$INFO_PLIST"' EXIT
unzip -p "$IPA_PATH" "$INFO_ENTRY" > "$INFO_PLIST"
IPA_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INFO_PLIST")"
IPA_BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$INFO_PLIST")"
IPA_BUNDLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$INFO_PLIST")"
EXPECTED_VERSION="$(node -p "require(process.argv[1]).expo.version" "$ROOT_DIR/app.json")"
EXPECTED_BUILD="$(node -p "require(process.argv[1]).expo.ios.buildNumber" "$ROOT_DIR/app.json")"
EXPECTED_BUNDLE="$(node -p "require(process.argv[1]).expo.ios.bundleIdentifier" "$ROOT_DIR/app.json")"
if [[ "$IPA_VERSION" != "$EXPECTED_VERSION" || "$IPA_BUILD" != "$EXPECTED_BUILD" || "$IPA_BUNDLE" != "$EXPECTED_BUNDLE" ]]; then
  echo "IPA does not match the prepared release. Expected $EXPECTED_BUNDLE $EXPECTED_VERSION ($EXPECTED_BUILD); found $IPA_BUNDLE $IPA_VERSION ($IPA_BUILD)." >&2
  echo "Build the prepared release before validating or uploading." >&2
  exit 1
fi

ALTOOL_ARGS=(
  "$OPERATION"
  -f "$IPA_PATH"
  -t ios
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
