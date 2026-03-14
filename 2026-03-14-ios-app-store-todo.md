# iOS App Store TODO

**Date:** March 14, 2026
**Scope:** `apps/ios`
**Status:** Not ready for App Store submission yet

## Summary

The iOS app is technically in decent shape:

- local `Release` iOS build succeeded
- the built app launched on iPhone and iPad simulators

The remaining gaps are mostly App Store policy, release setup, and shipping QA.

## Current Blockers

### 1. In-app account deletion was missing

Status on March 14, 2026:

- implemented in the iOS app

The app supports account sign-in and now exposes account deletion from settings.

- UI: `apps/ios/src/components/SettingsModal.tsx`
- auth layer: `apps/ios/src/services/auth.ts`

Why this blocks shipping:

- Apple requires apps that let users create accounts to also let users initiate account deletion inside the app.

Implemented:

- delete account action in settings
- confirmation flow
- Firebase Auth user deletion
- synced Firebase data deletion
- local progress cleanup after deletion

### 2. Sign in with Apple was missing

Status on March 14, 2026:

- implemented in the iOS app

The current iOS auth flow now supports both Google and Apple sign-in.

- implementation: `apps/ios/src/services/auth.ts`

Why this likely blocks shipping:

- Apple guideline 4.8 generally requires Sign in with Apple when third-party sign-in is offered for the app account, unless a narrow exception applies.

Implemented:

- Sign in with Apple capability and implementation

### 3. Privacy policy and support pages are updated, but App Store Connect privacy setup is still pending

The public privacy and support pages now reflect the current web and iOS behavior, but App Store Connect metadata still needs to be confirmed manually.

- `apps/web/src/components/LegalPage.tsx`
- `docs/IOS_APP_STORE_RELEASE.md`

Updated:

- privacy policy now distinguishes web and iOS data handling
- Google Analytics is described as web-only
- iOS in-app account deletion is documented
- public `/support` page exists for App Store Connect support URL use

Why this blocks shipping:

- App Store privacy disclosures and public privacy policy need to match actual iOS app behavior.

What is missing:

- App Store Connect privacy questionnaire answers
- support URL and privacy policy URL confirmed in App Store Connect

### 4. Production release profile is added, but production build/submission work is still pending

The repo now includes checked-in `preview` and `production` EAS profiles plus a documented release process.

- `apps/ios/eas.json`
- `docs/IOS_APP_STORE_RELEASE.md`

Current state:

- `preview` internal build profile exists
- `production` store build profile exists
- EAS remote build-number management is documented

Why this blocks shipping:

- a production/TestFlight artifact still needs to be built and submitted.

What is missing:

- release signing confirmation
- production/TestFlight build
- TestFlight submission

### 5. Release QA is still incomplete

Project docs still list release work as future work.

- `docs/NATIVE_IOS.md`

Still called out there:

- comprehensive device testing
- performance profiling
- accessibility verification
- TestFlight beta

Why this matters:

- the app declares tablet support, so iPhone-only smoke testing is not enough
- App Review risk goes up if accessibility or tablet behavior is rough

## Non-Blocking Notes

### Info.plist/app config mismatch

There is a dark-mode intent in `apps/ios/app.json`, but the native plist currently resolves `UIUserInterfaceStyle` to `Light`.

- `apps/ios/app.json`
- `apps/ios/ios/Dit/Info.plist`

This is not necessarily a submission blocker, but it should be intentional before shipping.

### Native/tablet polish may still need validation

The app supports iPad and uses custom native UI pieces. Nothing failed in simulator smoke tests, but this still needs a real QA pass.

## Validation Completed On March 14, 2026

- lint passed
- iOS unit tests passed
- local Release build succeeded
- Xcode store validation passed during local build
- app launched on:
  - iPhone simulator
  - iPad simulator

## Ship Checklist

### Policy and compliance

- [x] Add in-app account deletion flow
- [x] Delete Firebase Auth account from iOS flow, including Apple reauth and token revocation for Apple users
- [x] Delete remote synced progress during account deletion
- [x] Clear local app progress after account deletion
- [x] Add Sign in with Apple or document a valid exception
- [x] Update privacy policy so it reflects actual iOS behavior
- [x] Remove or justify Google Analytics references for iOS
- [ ] Confirm App Store Connect privacy answers
- [ ] Confirm privacy policy URL in App Store Connect
- [ ] Confirm support URL in App Store Connect

### Release setup

- [x] Add a production/store EAS build profile
- [x] Define release versioning process for `version` and `buildNumber`
- [ ] Confirm bundle ID, team, and signing assets are correct for release
- [ ] Build a production/TestFlight artifact
- [ ] Submit a TestFlight build

### Product QA

- [ ] Test full sign-in flow on device
- [ ] Test cloud sync end to end on device
- [ ] Test sign-out and re-sign-in state restoration
- [ ] Test deletion flow end to end
- [ ] Test iPad layout in all major surfaces
- [ ] Test practice, freestyle, and listen modes manually
- [ ] Test NUX flow on fresh install
- [ ] Test offline behavior while signed out and signed in
- [ ] Run accessibility pass for VoiceOver, labels, and touch targets
- [ ] Do basic performance pass on lower-end supported devices

### App Store assets and metadata

- [ ] Prepare iPhone screenshots
- [ ] Prepare iPad screenshots if shipping universal
- [ ] Write App Store subtitle and description
- [ ] Prepare keywords and promotional text
- [ ] Prepare review notes for sign-in and any special setup
- [ ] Confirm age rating and content declarations

## Recommended Next Steps in Priority Order

1. Confirm App Store Connect privacy answers and set the privacy/support URLs.
2. Confirm signing assets, then build a `production` iOS artifact.
3. Submit a TestFlight build.
4. Run device QA and accessibility pass.
5. Prepare App Store Connect metadata and screenshots.

## Definition of Ready

The app is ready for App Store submission when:

- policy blockers are resolved
- privacy disclosures match reality
- a production/TestFlight build exists
- device QA is complete on iPhone and iPad
- App Store Connect metadata is fully prepared
