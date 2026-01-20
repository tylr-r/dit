# Repository Guidelines

## Project Structure & Module Organization

- `apps/web`: Vite + React web app, with unit tests in `apps/web/tests/unit` and Playwright tests in `apps/web/tests/e2e`.
- `apps/ios`: Expo React Native app; assets live in `apps/ios/assets`, native code in `apps/ios/ios` and `apps/ios/native`.
- `packages/core`: Shared Morse-code logic used by web and iOS; unit tests live in `packages/core/tests/unit`.
- `modules/dit-native`: Custom native module used by the iOS app.
- `scripts`: repo maintenance scripts (postinstall patches, tooling helpers).

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies.
- `pnpm run dev`: Do not run this command. Ask the user to run it to start all app dev servers in parallel via Turbo.
- `pnpm --filter @dit/web dev`: Do not run this command. Ask the user to run it to start only the web app locally.
- `pnpm --filter @dit/ios dev`: Do not run this command. Ask the user to run it to start only the Expo iOS app.
- `pnpm run build`: build all packages/apps with Turbo.
- `pnpm run lint`: lint all workspaces via ESLint.
- `pnpm run test:unit`, `pnpm run test:e2e`, `pnpm run test:types`: run unit tests, Playwright e2e, or TypeScript checks across the repo.

## Coding Style & Naming Conventions

- TypeScript + React codebase; prefer 2-space indentation, single quotes, and no semicolons.
- Exported components should include concise JSDoc (see `STYLE_GUIDE.md`).
- Component files use `PascalCase.tsx`; hooks follow the `useThing` naming convention.
- Reference `APP_BEHAVIOR.md` when changing app logic or flows to keep behavior consistent across platforms.

## Testing Guidelines

- Unit tests use Vitest; React UI tests use Testing Library.
- Unit test files use `*.test.ts` or `*.test.tsx` naming.
- Playwright e2e tests live in `apps/web/tests/e2e` and use `*.spec.ts`.
- Prefer targeted runs, e.g. `pnpm --filter @dit/web test:unit:run` or `pnpm --filter @dit/core test:unit`.

## Commit & Pull Request Guidelines

- Commit messages are short, imperative summaries (e.g., “Add iOS modes and reference grid”) with concise sub notes of important changes.
- PRs should include a clear description, testing notes, and linked issues.
- Include screenshots or screen recordings for UI changes in web or iOS.

## Configuration & Security Tips

- Environment files live at `.env` and `apps/ios/.env`; avoid committing secrets outside these patterns.
- Firebase configuration is shared via `firebase.json` and `apps/ios/GoogleService-Info.plist`.
