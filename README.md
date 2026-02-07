# Dit

Dit is a Morse code practice app for web and iOS. It offers various modes to help users learn and practice Morse code, providing instant feedback and tracking progress. The app is built using a monorepo architecture with shared logic and native modules for audio and haptic feedback.

## Principles

- **Convenient daily practice** — Easy to use and accessible for consistent learning
- **Auditory reflex over decoding** — Build direct sound-to-character recognition rather than analytical translation
- **Koch method foundation** — Start at manageable speeds with Farnsworth spacing and high-frequency characters
- **Variable speed training** — Gradually increase effective speed through adjustable Farnsworth spacing
- **Early meaningful words** — Learn high-frequency characters first to form words quickly
- **Self-paced progression** — Carousel structure removes rigid linear requirements

## Modes

**Practice** — Match the prompted letter. Get it right, move on. Get it wrong, start over.

**Freestyle** — Tap out whatever you want and see what letter it is. Word mode lets you spell things out.

**Listen** — Hear a letter, type the answer.

## Architecture

- Turborepo monorepo with shared Morse logic in `packages/core`
- Web app in `apps/web` (Vite + React)
- iOS app in `apps/ios` (Expo + React Native)
- Native bridge in `modules/dit-native` (audio, haptics, glass view)
- Firebase Auth + Realtime Database for sync
- UI intent: web ships custom React components; iOS prefers Expo UI/SwiftUI components when available, with React Native fallbacks as needed

## Repo layout

- `apps/web` — web client, unit tests in `apps/web/tests/unit`, e2e tests in `apps/web/tests/e2e`
- `apps/ios` — iOS app, assets in `apps/ios/assets`, native code in `apps/ios/ios` and `apps/ios/native`
- `packages/core` — shared Morse logic + types
- `modules/dit-native` — Expo native module
- `scripts` — repo tooling helpers

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

See `docs/` for detailed references:

- [APP_BEHAVIOR.md](docs/APP_BEHAVIOR.md) — intended behavior across platforms
- [STYLE_GUIDE.md](docs/STYLE_GUIDE.md) — code style and naming conventions
- [NATIVE_IOS.md](docs/NATIVE_IOS.md) — iOS native module details
- [PEDAGOGICAL_PHILOSOPHY.md](docs/PEDAGOGICAL_PHILOSOPHY.md) — learning methodology
