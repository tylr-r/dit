# Native Module Bridge Guide

This folder tracks the optional native implementation that Expo modules can surface to replace the JavaScript-only fallbacks.

## Goals

- Provide a `DitGlassView` view manager that renders SwiftUI glass surfaces (blur, gradient, rounded corners with shadows).
- Provide a `DitNative` module with functions for precise audio playback (dot/dash tone scheduling) and haptics patterns (dot, dash, success).

## Expo module setup

1. Run `npx expo-module-scripts init` inside `apps/ios` to scaffold an iOS native module (or use `npx expo prebuild --platform ios` if you need native project files).
2. Implement a Swift class that exposes the following methods via `@objc`:
   ```swift
   @objc func startTone(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock)
   @objc func stopTone(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock)
   @objc func playTone(_ durationMs: NSNumber, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock)
   @objc func triggerHaptic(_ kind: NSString, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock)
   ```
3. Register the module under the name `DitNative` so `requireOptionalNativeModule('DitNative')` resolves. The Swift source is staged under `apps/ios/native/ios/DitNativeModule.swift`.
4. The view manager stub lives in `apps/ios/native/ios/DitGlassView.swift`; it exports `DitGlassView` with an `intensity` prop and renders a native blur/gradient surface before optionally injecting SwiftUI content.

## Runtime behavior

- When `DitNative` is available, `apps/ios/src/native/audio.ts` will route tone generation to the native implementation, bypassing Expo AvAudio.
- Haptics also prefer `DitNative.triggerHaptic(kind)` before falling back to `expo-haptics`.
- `GlassSurface` renders the native view when `NativeGlassView` exists; otherwise it defaults to the JS blur+gradient surface.

## Testing

- Build the iOS native module and run `pnpm --filter @dit/ios ios` to confirm the native view and module are picked up.
- Monitor the console for `DitNative` logs and ensure haptic/audio functions resolve before toggling them from the UI.
