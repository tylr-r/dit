#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_PATH="$ROOT_DIR/ios/Dit.xcworkspace"
SCHEME_NAME="Dit"
EXPORT_OPTIONS_PLIST="$ROOT_DIR/ExportOptions-AppStore.plist"
BUILD_ROOT="$ROOT_DIR/build/app-store"
ARCHIVE_PATH="$BUILD_ROOT/Dit.xcarchive"
EXPORT_PATH="$BUILD_ROOT/export"
PACKAGE_JSON_PATH="$ROOT_DIR/package.json"

BUILD_NUMBER="${1:-}"
VERSION="${VERSION:-}"

if [[ -z "$BUILD_NUMBER" ]]; then
  BUILD_NUMBER="$(
    node -e "const fs=require('fs');const path=require('path');const app=JSON.parse(fs.readFileSync(path.join(process.cwd(),'app.json'),'utf8'));const current=Number(app.expo?.ios?.buildNumber ?? 0);process.stdout.write(String(current + 1));"
  )"
fi

if [[ -z "$VERSION" ]]; then
  VERSION="$(
    node -e "const fs=require('fs');const path=require('path');const app=JSON.parse(fs.readFileSync(path.join(process.cwd(),'app.json'),'utf8'));process.stdout.write(String(app.expo?.version ?? '1.0.0'));"
  )"
fi

echo "Using version $VERSION ($BUILD_NUMBER)"

node -e "const fs=require('fs');const path=require('path');const appPath=path.join(process.cwd(),'app.json');const app=JSON.parse(fs.readFileSync(appPath,'utf8'));app.expo ??= {}; app.expo.ios ??= {}; app.expo.ios.buildNumber=String(process.argv[1]); fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');" "$BUILD_NUMBER"

export DIT_ENABLE_DEV_CLIENT=0

PACKAGE_JSON_BACKUP="$(mktemp "$ROOT_DIR/package.json.backup.XXXXXX")"
cp "$PACKAGE_JSON_PATH" "$PACKAGE_JSON_BACKUP"
cleanup() {
  mv "$PACKAGE_JSON_BACKUP" "$PACKAGE_JSON_PATH"
}
trap cleanup EXIT

node -e "const fs=require('fs');const pkgPath=process.argv[1];const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));pkg.expo ??= {}; pkg.expo.autolinking ??= {}; const current=new Set(pkg.expo.autolinking.exclude ?? []); for (const name of ['expo-dev-client','expo-dev-launcher','expo-dev-menu','expo-dev-menu-interface']) current.add(name); pkg.expo.autolinking.exclude=[...current]; fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');" "$PACKAGE_JSON_PATH"

(
  cd "$ROOT_DIR/../.."
  pnpm install
)

pnpm exec expo prebuild --platform ios --no-install --clean

(
  cd "$ROOT_DIR/ios"
  pod install
)

rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"
mkdir -p "$BUILD_ROOT"

XCODEBUILD_ARGS=(
  -workspace "$WORKSPACE_PATH"
  -scheme "$SCHEME_NAME"
  -configuration Release
  -destination "generic/platform=iOS"
  -archivePath "$ARCHIVE_PATH"
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
  MARKETING_VERSION="$VERSION"
  DEVELOPMENT_TEAM="3HN9A5HR55"
  clean
  archive
)

if [[ "${ALLOW_PROVISIONING_UPDATES:-1}" == "1" ]]; then
  XCODEBUILD_ARGS=(-allowProvisioningUpdates "${XCODEBUILD_ARGS[@]}")
fi

xcodebuild "${XCODEBUILD_ARGS[@]}"

EXPORT_ARGS=(
  -exportArchive
  -archivePath "$ARCHIVE_PATH"
  -exportPath "$EXPORT_PATH"
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
)

if [[ "${ALLOW_PROVISIONING_UPDATES:-1}" == "1" ]]; then
  EXPORT_ARGS=(-allowProvisioningUpdates "${EXPORT_ARGS[@]}")
fi

xcodebuild "${EXPORT_ARGS[@]}"

IPA_PATH="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' -print -quit)"

if [[ -z "$IPA_PATH" ]]; then
  echo "Export succeeded but no .ipa was found in $EXPORT_PATH" >&2
  exit 1
fi

echo "Archive: $ARCHIVE_PATH"
echo "Export:  $EXPORT_PATH"
echo "IPA:     $IPA_PATH"
