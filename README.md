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

- Turborepo monorepo with shared look and feel and logic
- UI intent:
  - Similar look and feel across versions
  - Web ships custom React components
  - iOS looks like web version but prefers Expo UI/SwiftUI components when available

## Repo layout

- `apps/web`: React Web application (Vite)
- `apps/ios`: Native iOS application (Expo/React Native)
- `packages/core`: Shared business logic and types
- `docs/`: Project documentation, style guides, and architectural decisions

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

- Root `.env` for config
