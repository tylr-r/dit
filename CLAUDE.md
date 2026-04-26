# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Dit?

Dit is a Morse code practice app for web and iOS. It teaches auditory reflex (sound-to-character recognition) using Koch method fundamentals with Farnsworth spacing. Three modes: Practice (match prompted letters), Freestyle (tap and decode), Listen (hear and type).

## Monorepo Structure

Turborepo + pnpm workspaces. Four packages:

- `packages/core` (`@dit/core`) — shared Morse logic, types, constants, Firebase helpers, and hooks. Both apps depend on this.
- `apps/web` (`@dit/web`) — Vite + React 19 web client
- `apps/ios` (`@dit/ios`) — Expo 54 + React Native 0.81 iOS app
- `modules/dit-native` (`@dit/dit-native`) — Expo native module providing audio playback, haptics, and glass view via Swift/UIKit

## Commands

```bash
pnpm install                          # install all workspace deps
pnpm run lint                         # ESLint across all workspaces — run before commits
pnpm run test:unit                    # Vitest unit tests (all packages, watch mode)
pnpm run test:unit:run                # Vitest unit tests (single run, no watch)
pnpm run test:e2e                     # Playwright e2e tests (web only)
pnpm run test:types                   # TypeScript type checking
pnpm run deploy                       # build web + deploy to Firebase. Do not run this.
```

Run tests for a single workspace:

```bash
pnpm --filter @dit/web test:unit:run
pnpm --filter @dit/core test:unit:run
pnpm --filter @dit/ios test:unit
```

**Do not deploy the app, this is the developer's job. Do not run dev servers or build commands yourself.** As it is probably already running. If needed, give the user the command to run:

- `pnpm --filter @dit/web dev` (web dev server)
- `pnpm --filter @dit/ios ios` (iOS simulator)
- `pnpm --filter @dit/ios ios --device` (iOS physical device)

## Code Style

- TypeScript, 2-space indentation, single quotes, no semicolons
- Components: `PascalCase.tsx`. Hooks: `useThing.ts`
- Tests: `*.test.ts(x)` for unit, `*.spec.ts` for Playwright e2e
- Functional components with hooks; use early returns to reduce nesting
- Exported components get concise JSDoc describing role/intent
- iOS: prefer native UIKit components and Expo packages (`expo-glass-effect`, `@expo/ui`). Avoid SwiftUI via `UIHostingController`.
- Web: custom React components matching Dit's design language

## Key Behavioral References

- `docs/APP_BEHAVIOR.md` — canonical source for how modes, input, scoring, and NUX should work across platforms. **Read this before changing app logic.**
- `docs/PLATFORM_PARITY.md` — current iOS vs web feature delta and intentional differences. **Read this before working on cross-platform features**, and update it when you close (or open) a gap.
- `design.md` — visual, motion, and interaction direction. **Read this before any UI, animation, or onboarding change.** Records what we tried and removed, so you don't re-add it.
- `docs/STYLE_GUIDE.md` — code style, naming, and UI design principles
- `docs/NATIVE_IOS.md` — iOS native module architecture

## Agent Rules

- Prefer `pnpm` for all dependency operations
- Ask for confirmation before adding production dependencies
- Run `pnpm run lint` before commits, not after every change
