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
