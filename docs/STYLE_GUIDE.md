# Style Guide

Conventions for writing and organizing code in the Dit repo. Rules here are shared across workspaces unless a section calls out a specific platform.

## Code style

- TypeScript + React, strict typing preferred. Avoid implicit `any`.
- 2-space indentation, single quotes, no semicolons.
- Prefer functional components and hooks. Keep effects narrow; each effect should have one reason to re-run.
- Use early returns to flatten handlers and effects.
- Exported types are explicit. Export them alongside the value or hook that returns them.
- No barrel files (`index.ts` re-exports) unless the package has an existing one. Import directly from the source file.

## File naming

- Components: `PascalCase.tsx`
- Hooks: `useThing.ts`
- Utilities: `camelCase.ts`
- Tests: `*.test.ts` or `*.test.tsx` (Vitest)
- Playwright e2e specs: `*.spec.ts`

## Component documentation

- Exported components get a short JSDoc (one or two sentences) above the function.
- Describe the role or intent, not the name or the fact that it's a component.
- Skip JSDoc for trivial internal components and pure leaf presentational pieces.

## Styling

### Web (`apps/web`)

- Co-locate styles: each component has a sibling `.css` file of the same name (`Footer.tsx` + `Footer.css`). Global tokens and resets live in `index.css` and `App.css`.
- Use CSS custom properties for theming. Don't inline colors in component files.
- No CSS-in-JS. Keep the bundle boring.

### iOS (`apps/ios`)

- Use `StyleSheet.create` at the bottom of the component file.
- Pull colors, spacing, and radii from [apps/ios/src/design/tokens.ts](../apps/ios/src/design/tokens.ts). Motion tokens live in [apps/ios/src/components/nux/animationTokens.ts](../apps/ios/src/components/nux/animationTokens.ts).
- Don't introduce one-off sizes, hex values, or ad-hoc easings. Extend the tokens if the scale is genuinely short.
- See [DESIGN.md](../DESIGN.md) for the visual, motion, and interaction rules tied to those tokens.

## UI intent

- Web: custom React components that match Dit's design language. No UI library.
- iOS: prefer UIKit-backed components and Expo packages (`expo-glass-effect`, `@expo/ui`) so the system renders Liquid Glass where applicable. SwiftUI is fine when it's reached through `@expo/ui/swift-ui`. Raw `UIHostingController` bridges are avoided because they fight the React Native bridge.

## Design principles

- Show, don't list. Prefer numbered step rows, icon badges, and interactive previews over plain bullet lists. Make the screen something you feel, not something you read.
- Make data visual. When rendering domain content (letters, codes, stats), use chips, cards, or inline graphics instead of plain text. For Morse, always show the character alongside its dit/dah pattern.
- Earn vertical space. Every gap should do work. Large empty regions between content blocks usually mean the hierarchy is wrong.
- Hierarchy over uniformity. Use size, weight, and opacity to create clear layers (title, label, description) instead of three sibling text blocks.
- Personality over template. The UI should read as specifically Dit (a Morse app) rather than a generic onboarding wizard. Use the domain (letters, tones, dots, dashes) as visual material whenever it fits.

## Testing

- Unit tests live next to the file they test (`Foo.tsx` + `Foo.test.tsx`) or in a sibling `tests/unit/` directory, matching the pattern already used in the workspace.
- Vitest for unit tests across all packages. Playwright for web end-to-end flows, in `apps/web/tests/e2e`.
- Prefer behavioral tests: render a component, interact, assert the observable outcome. Don't assert on implementation details (internal state, intermediate hook returns).

## Commits and reviews

- Run `pnpm run lint` before committing, not after every change.
- Keep commits focused on one change. Reviewers should be able to understand a commit from its message alone.

## For AI coding agents

See [AGENTS.md](../AGENTS.md) for the agent-specific rules (what to ask before changing, what not to run, etc.). It complements this guide rather than replacing it.
