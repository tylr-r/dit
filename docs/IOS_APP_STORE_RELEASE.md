# iOS App Store Release

**Last Updated:** March 14, 2026
**Scope:** `apps/ios`

## Overview

The current App Store delivery flow is local and script-driven. Build and export
run through `xcodebuild`, and upload runs through `xcrun altool`.

Primary files:

- `apps/ios/scripts/build-app-store.sh`
- `apps/ios/scripts/upload-app-store.sh`
- `apps/ios/ExportOptions-AppStore.plist`
- `apps/ios/app.config.js`

## Versioning

Release versioning is split into two parts:

- `apps/ios/app.json` → `expo.version`
  - User-facing app version shown in App Store Connect, such as `1.0.1`
- `apps/ios/app.json` → `expo.ios.buildNumber`
  - Apple build number, such as `5`
  - `build-app-store.sh` updates this value before archiving
  - If no build number is passed, the script increments the current value by `1`

Recommended release flow:

1. Update `apps/ios/app.json` `expo.version` for the next public release.
2. Run lint.
3. Build and export the IPA with the next build number.
4. Upload the exported IPA to App Store Connect.

## Prerequisites

- Xcode and command line tools installed
- Apple signing configured for the `Dit` target
- `apps/ios/GoogleService-Info.plist` present locally
- required Expo/Firebase env vars available through the local `.env` setup

## Build And Export

Run from `apps/ios`:

```bash
pnpm run lint
pnpm run app-store:build -- 5
```

This script does the full release prep:

- writes `expo.ios.buildNumber`
- disables `expo-dev-client` for the release build
- runs `expo prebuild --platform ios --no-install`
- runs `pod install`
- runs `xcodebuild clean archive`
- runs `xcodebuild -exportArchive`

Artifacts are written to:

- archive: `apps/ios/build/app-store/Dit.xcarchive`
- export dir: `apps/ios/build/app-store/export`
- ipa: `apps/ios/build/app-store/export/Dit.ipa`

If you omit the build number:

```bash
pnpm run app-store:build
```

the script increments the current `expo.ios.buildNumber` automatically.

## Upload

Upload the most recent exported IPA:

```bash
pnpm run app-store:upload
```

Or upload an explicit IPA path:

```bash
pnpm run app-store:upload -- ./build/app-store/export/Dit.ipa
```

### API Key Auth

```bash
export APP_STORE_CONNECT_API_KEY='YOUR_API_KEY_ID'
export APP_STORE_CONNECT_ISSUER_ID='YOUR_ISSUER_ID'
export APP_STORE_CONNECT_P8_FILE='/absolute/path/AuthKey_XXXXXX.p8'
pnpm run app-store:upload
```

### Apple ID Auth

```bash
export APP_STORE_CONNECT_USERNAME='you@example.com'
export APP_STORE_CONNECT_PASSWORD='app-specific-password'
pnpm run app-store:upload
```

## Release Checklist

- Confirm `apps/ios/app.json` values are correct:
  - `expo.version`
  - `expo.ios.bundleIdentifier`
- Confirm Apple signing and the correct team are selected in Xcode / Apple Developer.
- Confirm App Store Connect metadata includes:
  - Privacy policy URL: `https://practicedit.com/privacy`
  - Support URL: `https://practicedit.com/support`
- Prepare the remaining App Store copy from `docs/IOS_APP_STORE_METADATA.md`.
- Complete manual QA on iPhone and iPad before submission.
- Review App Store privacy answers against the current iOS implementation before submitting.

## Notes

- The App Store export uses `apps/ios/ExportOptions-AppStore.plist`.
- The release build intentionally excludes `expo-dev-client` even though it remains installed for local development builds.
- `apps/ios/app.config.js` removes the `expo-dev-client` plugin when `DIT_ENABLE_DEV_CLIENT=0`.
- The privacy policy and support URL now live on the public web app routes, so those URLs can be reused in App Store Connect.
- Store description, keywords, promotional text, review notes, and screenshot shot list now live in `docs/IOS_APP_STORE_METADATA.md`.
