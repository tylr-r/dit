# Style Guide

## Code style

- TypeScript + React, strict typing preferred.
- 2-space indentation, single quotes, no semicolons.
- Keep components functional and prefer hooks for shared logic.
- Avoid implicit `any` and ensure exported types are explicit.
- Use early returns to reduce nesting in handlers and effects.
- Keep styles grouped near the component, prefer `StyleSheet.create` on iOS.

## File naming

- Components: `PascalCase.tsx`
- Hooks: `useThing.ts`
- Tests: `*.test.ts` or `*.test.tsx`
- Playwright: `*.spec.ts`

## Component documentation

- Use concise but useful JSDoc above exported component functions.
- Describe the role and intent without repeating the component name.
- Keep wording helpful and scannable.

## UI intent

- Web UI: build custom React components that match the product’s design language.
- iOS UI: use native UIKit components (e.g., `UISegmentedControl`, `UIVisualEffectView`) for authentic iOS appearance. Prefer Expo packages (`expo-glass-effect`) when available. Avoid SwiftUI with `UIHostingController` due to React Native bridge complexity.

## Design principles

- **Show, don’t list.** Replace plain bullet lists with visual elements — numbered step rows, icon badges, or interactive previews. Users should feel the content, not read a spec sheet.
- **Make data visual.** When presenting domain content (letters, codes, stats), render it as styled chips, cards, or inline graphics rather than plain text. For Morse, show the letter alongside its dot/dash pattern.
- **Earn vertical space.** Every gap should serve a purpose. Avoid large empty regions between content blocks — tighten spacing so the screen feels cohesive and intentional.
- **Hierarchy over uniformity.** Use size, weight, and opacity to create clear visual layers (title → label → description) instead of same-styled text blocks.
- **Personality over template.** UI should feel specific to Dit — a Morse code app — not like a generic onboarding wizard. Use the app’s domain (letters, tones, dots/dashes) as visual material wherever possible.
