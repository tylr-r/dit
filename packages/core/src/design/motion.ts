/**
 * Shared motion tokens for both iOS and web. Keeping these in one place so
 * every beat feels like the same instrument (cohesion over variety).
 *
 * Platform-specific wrappers (react-native Easing, Animated.spring configs)
 * live in apps/ios/src/components/nux/animationTokens.ts and consume the
 * primitives here.
 */

/** Duration tokens in milliseconds. */
export const TIMING = {
  press: 120,
  snap: 160,
  standard: 240,
  medium: 320,
  exit: 140,
  morph: 520,
  wash: 320,
  breath: 3000,
  ripple: 1200,
  circleDraw: 500,
  connector: 700,
} as const

export type TimingToken = keyof typeof TIMING

/** Raw bezier control-point tuples. Use these with
 *  `cubic-bezier(...)` on web or `Easing.bezier(...)` on native. */
export const BEZIER = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
  drawer: [0.32, 0.72, 0, 1] as const,
}

export type BezierToken = keyof typeof BEZIER

/** Renders a bezier tuple as a CSS `cubic-bezier()` string. */
export const cubicBezier = (points: readonly [number, number, number, number]) =>
  `cubic-bezier(${points[0]}, ${points[1]}, ${points[2]}, ${points[3]})`

export const CTA_SLOT_HEIGHT = 48
