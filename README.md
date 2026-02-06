# Dit

Morse code practice across web and iOS. Tap for dot, hold for dah.

## Principles

- One thing per mode
- Instant feedback
- Works on phone or keyboard
- Reference chart built in
- Tracks what you know (and what you don't)

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

iOS app (Expo):

```bash
pnpm --filter @dit/ios dev
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

## Environment

- Root `.env` for shared config
- `apps/ios/.env` for Expo-specific config
- `apps/ios/GoogleService-Info.plist` for Firebase iOS config (local only, copy from `apps/ios/GoogleService-Info.example.plist`)
