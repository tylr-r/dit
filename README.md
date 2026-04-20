# Dit

Dit is a Morse code practice app for web and iOS. It teaches Morse by ear, using the Koch method with Farnsworth spacing, so you build a direct sound-to-character reflex instead of mentally decoding dots and dashes. The repo is a monorepo with shared Morse logic, a Vite + React web app, an Expo iOS app, and a Swift/UIKit native module for audio, haptics, and glass effects.

## Principles

- Convenient daily practice. If it isn't easy to open and use, people don't come back.
- Auditory reflex over decoding. Build sound-to-character recognition, not a mental lookup table.
- Koch method foundation. Start at realistic character speed with Farnsworth spacing and introduce high-frequency letters first.
- Variable effective speed. Tighten inter-character gaps as proficiency grows rather than raising the per-character speed.
- Early meaningful words. High-frequency letters come first so learners can form real words within the first lessons.
- Self-paced progression. Beginners get a guided course that advances in small packs; anyone else can free-roam across modes without a fixed sequence.

See [docs/PEDAGOGICAL_PHILOSOPHY.md](docs/PEDAGOGICAL_PHILOSOPHY.md) for the long version.

## Modes

- Practice: match the prompted letter. Get it right and it moves on. Get it wrong and, depending on settings, the app either keeps you on the same target or drops it and advances (IFR mode). Word mode strings letters into a full word.
- Freestyle: tap out whatever you want, pause, and the app tells you which letter you sent. Word mode accumulates letters with automatic spaces on word gaps.
- Listen: the app plays a letter at the chosen WPM and you type the answer.

## Architecture

- Turborepo + pnpm workspaces. Shared Morse logic lives in `packages/core`.
- Web app in `apps/web` (Vite + React 19).
- iOS app in `apps/ios` (Expo SDK 55 + React Native 0.81).
- Native bridge in `modules/dit-native` (audio playback, haptics, glass view) implemented in Swift/UIKit.
- iOS also ships a `DitProgress` home-screen widget driven by the same progress data as the in-app Reference view.
- Firebase Auth + Realtime Database for cross-device sync. Firebase Analytics for basic usage events.
- UI intent: web uses custom React components matching Dit's design language; iOS prefers Expo UI and UIKit components so the system renders Liquid Glass where applicable, with React Native fallbacks as needed.

## Repo layout

- `apps/web`: web client. Unit tests in `apps/web/tests/unit`, Playwright e2e in `apps/web/tests/e2e`.
- `apps/ios`: iOS app source. `src/` for TS/RN code, `ios/` for the generated Xcode project and Pods, `plugins/` for Expo config plugins, `assets/` for images and fonts, `tests/` for unit tests.
- `packages/core`: shared Morse logic, types, constants, Firebase helpers, and React hooks.
- `modules/dit-native`: Expo native module (Swift/UIKit).
- `scripts`: small repo tooling helpers.

## Running locally

Install deps:

```bash
pnpm install
```

Web app:

```bash
pnpm --filter @dit/web dev
```

iOS app simulator:

```bash
pnpm --filter @dit/ios ios
```

iOS app on physical device:

```bash
pnpm --filter @dit/ios ios --device
```

Run all dev servers via Turbo:

```bash
pnpm run dev
```

## Tooling

```bash
pnpm run build
pnpm run lint
pnpm run test:unit
pnpm run test:e2e
pnpm run test:types
```

## Deploy

```bash
pnpm run deploy        # builds web app and deploys to Firebase
```

## Environment

- Root `.env` for shared config
- `apps/ios/.env` for Expo-specific config
- `apps/ios/GoogleService-Info.plist` for Firebase iOS config (local only, copy from `apps/ios/GoogleService-Info.example.plist`)

## Docs

- [docs/APP_BEHAVIOR.md](docs/APP_BEHAVIOR.md): intended behavior across platforms.
- [docs/PEDAGOGICAL_PHILOSOPHY.md](docs/PEDAGOGICAL_PHILOSOPHY.md): the learning methodology behind the modes and progression.
- [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md): code style, naming, and UI design principles.
- [docs/NATIVE_IOS.md](docs/NATIVE_IOS.md): iOS native module architecture.
- [DESIGN.md](DESIGN.md): visual, motion, and interaction direction; also what we've tried and removed.
- [AGENTS.md](AGENTS.md): rules for AI coding agents working in this repo.
