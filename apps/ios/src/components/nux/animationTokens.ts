import { Easing } from 'react-native'

/** Shared motion tokens for the NUX flow. Keeping these in one place so every
 *  beat feels like the same instrument (cohesion over variety). */

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

/** React Native Easing curves — stronger than Easing.quad. */
export const EASE = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  drawer: Easing.bezier(0.32, 0.72, 0, 1),
}

/** Raw bezier tuples for Reanimated's Easing.bezier (worklet-safe import). */
export const BEZIER = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
  drawer: [0.32, 0.72, 0, 1] as const,
}

/** React Native Animated.spring configs. */
export const SPRING = {
  snappy: { tension: 300, friction: 22, useNativeDriver: true },
  soft: { tension: 180, friction: 20, useNativeDriver: true },
  pop: { tension: 400, friction: 12, useNativeDriver: true },
} as const

/** Reanimated withSpring configs (different param names). */
export const RSPRING = {
  snappy: { damping: 22, stiffness: 300 },
  soft: { damping: 20, stiffness: 180 },
  pop: { damping: 12, stiffness: 400 },
}

export const CTA_SLOT_HEIGHT = 48
