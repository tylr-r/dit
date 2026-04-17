import { triggerHaptics } from '@dit/dit-native'

/** Haptic vocabulary for the NUX flow. Multi-sensory polish — each pattern is
 *  small (<60ms) so it feels like a tactile accent, not a buzz.
 *  Patterns are milliseconds; arrays alternate wait/buzz. */

const PATTERNS = {
  tick: 10,
  soft: 18,
  success: [0, 12, 80, 28],
  morph: [0, 24, 40, 14],
} as const

function fire(pattern: number | readonly number[]) {
  void triggerHaptics(pattern as number | number[])
}

export const nuxHaptics = {
  tick: () => fire(PATTERNS.tick),
  soft: () => fire(PATTERNS.soft),
  success: () => fire(PATTERNS.success),
  morph: () => fire(PATTERNS.morph),
}
