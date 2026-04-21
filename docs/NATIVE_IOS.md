# Native iOS module

`modules/dit-native` is the Expo native module that bridges Swift/UIKit capabilities into the React Native app. Consumed as `@dit/dit-native` via the pnpm workspace.

## Why it exists

Three things that RN libraries can't do well:

- **Morse audio.** Low-latency tone playback with tight dit/dah timing, paired with CoreHaptics so the user feels the same rhythm they hear. Done through `AVAudioEngine` + a `CHHapticEngine` pattern player in the same Swift class so timing stays in sync.
- **Auth.** Google and Apple sign-in go through Firebase, but the credential handshake has to happen in native code (Apple's `ASAuthorizationController`, GoogleSignIn's presenting controller). We also do the Apple token revoke dance for account deletion here.
- **Widget support.** The home-screen widget lives in a separate target and reads files from an App Group container. `copyAssetToAppGroup` copies bundle assets into the shared container so the widget can render them.

## Surface

Everything is one Expo module named `DitNative` defined in [modules/dit-native/ios/DitNativeModule.swift](../modules/dit-native/ios/DitNativeModule.swift). Exported via [modules/dit-native/src/index.ts](../modules/dit-native/src/index.ts).

Audio (Morse sequencing bakes haptics in — no separate haptic API):
- `prepareToneEngine()` — warm up `AVAudioEngine` before the first user tap
- `startTone(frequency, volume)` / `stopTone()` — continuous tone for key-down input
- `playTone(frequency, durationMs, volume)` — one-shot for Listen mode
- `playMorseSequence(code, characterUnitMs, effectiveUnitMs, frequency, volume)` — plays a full code string with dits/dahs as audio + CoreHaptics pulses
- `stopMorseSequence()`

Auth:
- `signInWithGoogle()` / `signInWithApple()` — return credentials the JS side hands to Firebase
- `prepareAppleAccountDeletion(userId)` + `revokeAppleTokenForAccountDeletion(code, userId)` — Apple requires revoking the refresh token when deleting the account

System:
- `getLowPowerModeEnabled()` and the `onLowPowerModeChanged` event — used to gate animations/haptics when Low Power is on
- `copyAssetToAppGroup(sourceUri, appGroup, filename)` — for widget assets

Two call styles in the app:
- Typed wrappers from `@dit/dit-native` (`startTone`, `getLowPowerModeEnabled`, `copyAssetToAppGroup`, etc.) — preferred
- Direct `requireNativeModule<DitNativeModule>('DitNative')` in [apps/ios/src/services/auth.ts](../apps/ios/src/services/auth.ts) and [apps/ios/src/utils/tone.ts](../apps/ios/src/utils/tone.ts) where the wrapper doesn't expose the full shape yet

## Key decisions

- **UIKit, not SwiftUI.** Bridging SwiftUI through `UIHostingController` fights the RN view hierarchy. For glass surfaces we use `expo-glass-effect` (iOS 26 Liquid Glass) directly from JS instead of a custom wrapper.
- **One module, not one per capability.** Audio, haptics, auth, and system APIs all live in `DitNativeModule.swift`. Splitting them meant extra Expo config and pod registration for no real benefit.
- **Haptics piggyback on Morse audio.** `playMorseSequence` drives both `AVAudioEngine` and `CHHapticEngine` from the same timeline so they can't drift.
- **Firebase + GoogleSignIn are pod dependencies** (see [DitNative.podspec](../modules/dit-native/ios/DitNative.podspec)) — the module itself, not the app, owns the linkage.

## Rebuilding

Native Swift changes need a full rebuild. JS/TSX wrapper changes hot-reload.

```bash
pnpm --filter @dit/ios exec expo prebuild --clean   # regenerate ios/ from app.json + plugins
cd apps/ios/ios && pod install                 # only when podspec or expo-module.config.json changes
pnpm --filter @dit/ios ios                     # simulator
pnpm --filter @dit/ios ios --device            # physical device
```

Run `expo prebuild --clean` after changing `app.json`, any Expo config plugin, widget assets, or anything else that regenerates the native project. Drop `--clean` if you want to keep manual edits inside `ios/`.

Native logs: Xcode console, filter for "Dit". JS logs: Metro.

## Known gotchas

- `DitNativeModule` type in `src/index.ts` is incomplete (missing `playMorseSequence`, `stopMorseSequence`, `prepareToneEngine`). Call sites work around it by using `requireNativeModule` directly. Worth tightening up if the wrapper grows.
- `requireOptionalNativeModule` returns undefined on web, so every wrapper function guards with `?.` — keep that pattern when adding new ones.
