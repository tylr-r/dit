# Agent Guidelines

- Prefer `pnpm` when installing dependencies.
- Ask for confirmation before adding new production dependencies.
- Run `pnpm run lint` before running a build or making a commit. No need to run it if for every code change, just before making a git commit.
- Do not run build scripts yourself. Give the exact build command to the user and ask them to run it so we do not waste chat tokens or context on build output.

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
- Reference `docs/APP_BEHAVIOR.md` when changing app logic or flows to keep behavior consistent across platforms.
- Reference `docs/PLATFORM_PARITY.md` for the current iOS vs web feature delta and intentional differences. Update it when you close (or open) a gap.
- Reference `docs/DECISIONS.md` for durable product decisions that future agents should preserve.
- Reference `DESIGN.md` before making UI, motion, or onboarding changes — it's the canonical source for visual/interaction direction and notes what we've tried and removed.

## Testing Guidelines

- Unit tests use Vitest; React UI tests use Testing Library.
- Unit test files use `*.test.ts` or `*.test.tsx` naming.
- Playwright e2e tests live in `apps/web/tests/e2e` and use `*.spec.ts`.

## Documentation

- Keep `docs/APP_BEHAVIOR.md`, `docs/PLATFORM_PARITY.md`, `docs/DECISIONS.md`, and `DESIGN.md` up to date as you make changes. These are the canonical references for behavior, parity, durable product decisions, and design direction — outdated docs mislead future work.
- When closing or opening a platform parity gap, update `docs/PLATFORM_PARITY.md`.
- When adding, changing, or removing a behavior or flow, update `docs/APP_BEHAVIOR.md`.
- When making an explicit product decision that future work should preserve, add a concise entry to `docs/DECISIONS.md`. This is for product intent and rationale, not a copy of git history or every implementation change.
- When making a UI, motion, or interaction design direction change (including things tried and removed), update `DESIGN.md`.
- When landing user-visible work for the next release, add release notes to **Unreleased** in `docs/CHANGELOG.md`. Rename that section to the version number when you ship.

### Changelog (`docs/CHANGELOG.md`)

The changelog is **public-facing** release notes for people using Dit — not an engineering log. Read the shipped sections (`2026.5.31`, etc.) for voice before writing.

**Include only what changed in this release**

- Before adding a line, verify it against the prior release baseline (e.g. `git log` / `git show` on the last tagged or changelog version). Do not claim a feature is new if it already shipped in an earlier release.
- Do not list behavior that was already true and you only documented in `APP_BEHAVIOR.md` or `DECISIONS.md`.
- Do not list refactors, dead-code removal, analytics wiring, or other internal work unless a user would notice.

**How to write entries**

- Use **Highlights** (big additions), **Changes** (improvements users feel), and **Fixes** (bugs). No Cleanup, Product decisions, or links to internal docs.
- Plain language only: no file paths, package names, symbols, commit hashes, or implementation detail.
- Say **Web:** or **iOS:** only when the change is genuinely single-platform. Confirm with git — shared core fixes often land on **both** platforms even when you only touched one app's UI.
- One user-visible outcome per bullet. Do not repeat the same fix under both Changes and Fixes.

**Where other docs go**

- Durable product intent → `docs/DECISIONS.md`
- Cross-platform behavior spec → `docs/APP_BEHAVIOR.md`
- iOS vs web delta → `docs/PLATFORM_PARITY.md`
- Do not copy those into the changelog; users should not need them to understand an update.

## Commit & Pull Request Guidelines

- Commit messages are short, imperative summaries (e.g., “Add iOS modes and reference grid”) with concise sub notes of important changes. This should be human-readable and explain the “what” and “why” of the change, not the “how” (the code should show that).
- Group related changes into a single commit rather than committing after every edit. Wait to commit until you have a logical chunk of work that represents a single change or feature.
- PRs should include a clear description, testing notes, and linked issues.
- Include screenshots or screen recordings for UI changes in web or iOS.
