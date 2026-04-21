import { BEZIER, CTA_SLOT_HEIGHT, TIMING } from '@dit/core'
import { Easing } from 'react-native'

/** Re-exported shared primitives so call sites can keep importing from here. */
export { BEZIER, CTA_SLOT_HEIGHT, TIMING }

/** React Native Easing curves — stronger than Easing.quad. */
export const EASE = {
  out: Easing.bezier(...BEZIER.out),
  inOut: Easing.bezier(...BEZIER.inOut),
  drawer: Easing.bezier(...BEZIER.drawer),
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
