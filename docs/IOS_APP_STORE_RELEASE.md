# iOS App Store Release

**Last Updated:** March 14, 2026
**Scope:** `apps/ios`

## Build Profiles

The repo now defines three iOS EAS build profiles in `apps/ios/eas.json`:

- `development`: simulator development client
- `preview`: internal device build for QA
- `production`: store distribution build for TestFlight / App Store submission

## Versioning

Release versioning is split into two parts:

- `apps/ios/app.json` → `expo.version`
  - User-facing app version shown in App Store Connect, such as `1.0.1`
- EAS remote build number
  - `apps/ios/eas.json` sets `cli.appVersionSource` to `remote`
  - `preview` and `production` use `autoIncrement: true`
  - Each EAS build increments the iOS build number automatically

Recommended release flow:

1. Update `apps/ios/app.json` `expo.version` for the next public release.
2. Commit the version change before cutting release builds.
3. Build with the `preview` profile for final QA if needed.
4. Build with the `production` profile for TestFlight / App Store.

## Commands

Run from the repo root:

```bash
pnpm --filter @dit/ios exec eas build --platform ios --profile preview
pnpm --filter @dit/ios exec eas build --platform ios --profile production
pnpm --filter @dit/ios exec eas submit --platform ios --latest
```

Use `eas submit --latest` immediately after a `production` build, or pass a
specific build ID if multiple recent iOS builds exist.

## Release Checklist

- Confirm `apps/ios/app.json` values are correct:
  - `expo.version`
  - `expo.ios.bundleIdentifier`
- Confirm Apple signing assets and the correct team are selected in EAS / Apple Developer.
- Confirm App Store Connect metadata includes:
  - Privacy policy URL: `https://practicedit.com/privacy`
  - Support URL: `https://practicedit.com/support`
- Complete manual QA on iPhone and iPad before submission.
- Review App Store privacy answers against the current iOS implementation before submitting.

## Notes

- `preview` is intended for installable internal builds.
- `production` is the checked-in store profile for TestFlight and App Store distribution.
- The privacy policy and support URL now live on the public web app routes, so those URLs can be reused in App Store Connect.
