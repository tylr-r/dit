# Native iOS module

`modules/dit-native` is the Expo native module that bridges Swift/UIKit capabilities into the React Native app. Consumed as `@dit/dit-native` via the pnpm workspace.

## Why it exists

Three things that RN libraries can't do well:

- **Morse audio.** Low-latency tone playback with tight dit/dah timing, paired with CoreHaptics so the user feels the same rhythm they hear. Done through `AVAudioEngine` + a `CHHapticEngine` pattern player in the same Swift class so timing stays in sync.
- **Auth.** Google and Apple sign-in go through Firebase, but the credential handshake has to happen in native code (Apple's `ASAuthorizationController`, GoogleSignIn's presenting controller). We also do the Apple token revoke dance for account deletion here.
- **Widget support.** The home-screen widget lives in a separate target and reads files from an App Group container. `copyAssetToAppGroup` copies bundle assets into the shared container so the widget can render them.
- **External paddle input.** VBand-style hardware keys arrive through UIKit `pressesBegan` / `pressesEnded`, which React Native does not surface reliably for non-text controls.

## Surface

Everything is one Expo module named `DitNative` defined in [modules/dit-native/ios/DitNativeModule.swift](../modules/dit-native/ios/DitNativeModule.swift). Exported via [modules/dit-native/src/index.ts](../modules/dit-native/src/index.ts).

Audio (Morse sequencing drives haptics on the same timeline; the haptic engine has its own gate so users can mute vibration without losing the tone). Default tone amplitude is `AUDIO_VOLUME` in `@dit/core`, clamped by `resolveToneVolume` before native calls:
- `prepareToneEngine()` — warm up `AVAudioEngine` before the first user tap
- `startTone(frequency, volume)` / `stopTone()` — continuous tone for key-down input; key-down also starts a continuous CoreHaptics player
- `playTone(frequency, durationMs, volume)` — one-shot for Listen mode
- `playMorseSequence(code, characterUnitMs, effectiveUnitMs, frequency, volume)` — plays a full code string with dits/dahs as audio + CoreHaptics pulses
- `stopMorseSequence()`
- `getMorsePlaybackState()` returns native sample-clock elapsed time, duration, pause state, and final-buffer completion
- `pauseMorseSequence()` / `resumeMorseSequence()` pause and resume audio and sequence haptics together
- `setHapticsEnabled(enabled)` — toggles the `HapticController.isEnabled` flag; disabling stops any in-flight player and short-circuits future `startKeying` / `playMorseSequence` calls until re-enabled

Auth:
- `signInWithGoogle()` / `signInWithApple()` — return credentials the JS side hands to Firebase
- `prepareAppleAccountDeletion(userId)` + `revokeAppleTokenForAccountDeletion(code, userId)` — Apple requires revoking the refresh token when deleting the account

System:
- `getLowPowerModeEnabled()` and the `onLowPowerModeChanged` event — used to gate animations/haptics when Low Power is on
- `getOutputVolume()` and the `onOutputVolumeChanged` event — reads `AVAudioSession.outputVolume` (0–1) for NUX sound check when system volume looks too low
- `copyAssetToAppGroup(sourceUri, appGroup, filename)` — for widget assets
- `setExternalMorseKeyCaptureEnabled(enabled)` and the `onExternalMorseKey` event — installs a zero-size first-responder view while enabled and emits `{ symbol: "." | "-", phase: "down" | "up" }` for VBand-compatible left Control / `[` and right Control / `]` paddle input. The JS app only enables this on the unobstructed Practice/Freestyle surface or Conversation reply turn with no copy field focused so sheets and text entry keep normal hardware-key behavior.

Two call styles in the app:
- Typed wrappers from `@dit/dit-native` (`startTone`, `getLowPowerModeEnabled`, `copyAssetToAppGroup`, etc.) — preferred
- Direct `requireNativeModule<DitNativeModule>('DitNative')` in [apps/ios/src/services/auth.ts](../apps/ios/src/services/auth.ts) and [apps/ios/src/utils/tone.ts](../apps/ios/src/utils/tone.ts) where the wrapper doesn't expose the full shape yet

## Key decisions

- **UIKit, not SwiftUI.** Bridging SwiftUI through `UIHostingController` fights the RN view hierarchy. For glass surfaces we use `expo-glass-effect` (iOS 26 Liquid Glass) directly from JS instead of a custom wrapper.
- **One module, not one per capability.** Audio, haptics, auth, and system APIs all live in `DitNativeModule.swift`. Splitting them meant extra Expo config and pod registration for no real benefit.
- **Haptics piggyback on Morse audio.** `playMorseSequence` drives both `AVAudioEngine` and `CHHapticEngine` from the same timeline so they can't drift. A user-toggleable `isEnabled` gate inside `HapticController` short-circuits the haptic engine without touching the audio path.
- **Firebase + GoogleSignIn are pod dependencies** (see [DitNative.podspec](../modules/dit-native/ios/DitNative.podspec)) — the module itself, not the app, owns the linkage.

## Rebuilding

Native Swift changes need a full rebuild. JS/TSX wrapper changes hot-reload.

```bash
pnpm --filter @dit/ios exec expo prebuild --clean   # regenerate ios/ from app.json + plugins
cd apps/ios/ios && pod install                 # only when podspec or expo-module.config.json changes
pnpm --filter @dit/ios ios                     # simulator
pnpm --filter @dit/ios ios --device            # physical device
```

Run `expo prebuild --clean` after changing `app.json`, any Expo config plugin, widget assets, or anything else that regenerates the native project. Keep native customizations in Expo plugins or `modules/dit-native`, and back up manual edits before regenerating. Do not omit `--clean` with the installed widgets plugin; repeated prebuilds can duplicate its target and source references.

Native logs: Xcode console, filter for "Dit". JS logs: Metro.

## Known gotchas

- `DitNativeModule` type in `src/index.ts` is incomplete (missing `playMorseSequence`, `stopMorseSequence`, `prepareToneEngine`, `setHapticsEnabled`). Call sites work around it by using `requireNativeModule` directly in [apps/ios/src/utils/tone.ts](../apps/ios/src/utils/tone.ts). Worth tightening up if the wrapper grows.
- `requireOptionalNativeModule` returns undefined on web, so every wrapper function guards with `?.` — keep that pattern when adding new ones.

## Conversation and App Check setup

Conversation uses `@react-native-firebase/ai` and `@react-native-firebase/app-check`
24.0.0, matching the existing app/analytics SDKs. The station prompt and session
are shared with web; the native adapter initializes App Check lazily when a
contact starts and passes that instance explicitly to Firebase AI Logic.

The local `withFirebaseAppCheck` plugin exposes `RNFBAppCheckModule` in the Swift
bridging header and registers its provider before the app plugin calls
`FirebaseApp.configure()`. RNFB 24's stock App Check Swift plugin can configure
Firebase twice, so do not add it alongside this local plugin. Keep the local
plugin before the Firebase App plugin in config because Expo executes dangerous
mods from last to first. App Attest uses the
production entitlement; debug builds use the debug provider.

Before verifying the first native QSO:

1. Confirm Firebase AI Logic is enabled for the `practice-dit` project, with the
   same Gemini Developer API backend and model used by web.
2. Register the iOS app with Firebase App Check for App Attest and DeviceCheck.
   For Simulator/dev-client testing, register a debug token and optionally set
   `EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN` in the local Expo environment.
   Do not commit the token. See [Firebase App Check setup](https://rnfirebase.io/app-check/usage).
   Registration is specific to the development token. A new simulator or removed
   app data can require another registration; normal restarts retain the token.
   Keep the token in local simulator storage, never in source or diagnostic output.
   Release builds continue using device attestation.
3. Regenerate native configuration and rebuild from the repository root:

   ```bash
   pnpm --filter @dit/ios exec expo prebuild --platform ios --clean
   pnpm --filter @dit/ios ios
   ```

Check Send first and Receive first, paused audio and haptics, replay, copy focus
at completion, optional comparison with trailing misses, keying while prosigns
are open, hardware paddles before/after copy focus, and End while a station reply
is pending. Check that scores, daily activity, recognition time, and streaks stay
unchanged. Also review a small phone with its keyboard open and VoiceOver.

Unit tests, Swift parsing, the simulator build, and simulator App Check registration have passed. A production archive and physical-device App Check/audio remain unverified.

## CocoaPods: duplicate widget target after prebuild

On October 4, a repeated prebuild without `--clean` created two
`ExpoWidgetsTarget` targets and groups. Both source phases referenced the same
`DitProgress.swift` build-file object. CocoaPods failed while saving the Xcode
project with `[Xcodeproj] Consistency issue: no parent for object DitProgress.swift`.
The trailing Ruby stack was a project-graph error. The installed widgets plugin
adds a target on each incremental prebuild, matching
[Expo issue 45090](https://github.com/expo/expo/issues/45090).

The local generated project was repaired by removing only the duplicate target,
its group, product, dependency, and phases. The original widget source files,
CocoaPods integration, and signing settings were preserved. Use `--clean` for
future regeneration, as recommended by
[Expo's CNG guide](https://docs.expo.dev/workflow/continuous-native-generation/).

This machine also has Xcode beta installed while `xcode-select -p` points to
Command Line Tools. Choose Xcode for a single command without changing global
selection:

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer pnpm --filter @dit/ios ios
```

This follows [Apple's command-line tools settings](https://developer.apple.com/documentation/xcode/configuring-command-line-tools-settings).

Project serialization and CocoaPods installation passed after the repair. The
app now builds and launches. After registering its simulator development token,
Conversation receives a station opener and starts native playback.

## Xcode 27: Device Hub replaces Simulator

Xcode 27 uses `DeviceHub.app` in `Contents/Applications` instead of
`Simulator.app` in `Contents/Developer/Applications`. The installed Expo SDK 55
CLI (55.0.25) only looked for Simulator and failed before building, even with
working `simctl` and installed iOS runtimes. Changing `xcode-select` alone cannot
restore the removed app.

`patches/@expo__cli@55.0.25.patch` backports the discovery and process checks from
[Expo PR 46757](https://github.com/expo/expo/pull/46757), with the device deep link
from [Expo PR 46809](https://github.com/expo/expo/pull/46809). It accepts Device
Hub's bundle ID, falls back to its Info.plist when LaunchServices has not indexed
it, opens the selected device, falls back to opening Device Hub directly if its
URL handler is unavailable, and makes window focus failure nonfatal. Older
Xcode installations keep the Simulator path. The patch is applied by
`pnpm install`; remove it when upgrading to a CLI release that includes these fixes.

Verify the installed CLI without running a build:

```bash
pnpm --filter @dit/ios exec vitest run tests/unit/expoSimulatorCompatibility.test.ts
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer node -e 'require("./node_modules/@expo/cli/build/src/start/doctor/apple/SimulatorAppPrerequisite.js").SimulatorAppPrerequisite.instance.assertAsync().then(() => console.log("Simulator prerequisite passed"))'
```

The compatibility tests cover both apps, the unregistered bundle fallback,
Device Hub opening, the direct-app fallback, and window focus failure. On
October 4, the patched prerequisite passed and the existing iOS 26.5 iPhone 17
booted. The first device-link window launch timed out; opening Device Hub
directly succeeded, after which Expo's running-app check and final window
activation passed. Native compilation and app playback remain separate
verification steps.

## Xcode 27: CocoaPods resource deployment targets

Xcode 27 rejects iOS deployment targets below 15.0. React Native's CocoaPods
post-install step raises main pod targets to its minimum, but leaves resource
bundle targets at their podspec values. This caused nine resource targets to
fail the build plan with deployment targets from 9.0 to 13.4.

The app explicitly configures iOS 15.1 through `expo-build-properties`.
`withMinimumPodDeploymentTarget` adds a post-install step that raises older pod
targets, including resources, to that configured minimum. Targets that require
a newer iOS version keep their requirement. Keep this in the plugin instead of
editing `Pods.xcodeproj`, because CocoaPods regenerates that project.

CocoaPods installation and an inspection of all generated pod configurations
passed after applying the fix. The iPhone 17 iOS 26.5 build succeeded, installed, and launched on October 4.
Metro served the app successfully. The iPhone 17 simulator development token was
registered with App Check and both the attestation exchange and Firebase AI model
request returned HTTP 200. A native received opener and playback were also verified.
Physical-device audio/haptics and a complete two-way contact remain pending.

## Conversation retry recovery

The Firebase AI chat implementations retain a rejected send promise after a
failed request. Reusing that chat makes subsequent Retry calls fail before
issuing another network request, even after App Check or connectivity recovers.
Both adapters now use a shared wrapper that replaces a failed SDK chat using a
copy of the accepted history. Failed and empty responses are excluded. The model,
system instructions, and station callsign remain the same for the contact.
The real-SDK regression test covers a successful turn, a failed request, and a
successful retry, including the exact history sent to the server.

## App Store release preparation

See [the 2026.10.4 iOS handoff](releases/2026.10.4-ios.md) for the current version,
metadata drafts, exact archive/validation/upload commands, and remaining device
checks. The build script's `--check` verifies release/RC Xcode and version inputs
without changing files. Beta toolchains are rejected before prebuild or package
changes. The upload script supports `--validate` and verifies that the IPA matches
the prepared bundle, version, and build before contacting App Store Connect.
Production archives remove dev-client autolinking temporarily and install from
the frozen workspace lockfile.
