/**
 * Shared design tokens for iOS UI primitives and components.
 * Keep raw color literals in this file and consume semantic tokens elsewhere.
 */
const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`
const hsla = (h: number, s: number, l: number, a: number) =>
  `hsla(${h}, ${s}%, ${l}%, ${a})`

export type HslTriplet = {
  h: number
  s: number
  l: number
}

export const hues = {
  primary: 24,
  liquid: 207,
  success: 154,
  error: 0,
} as const

const feedbackHsl = {
  success: { h: hues.success, s: 88, l: 58 },
  error: { h: hues.error, s: 100, l: 71 },
} as const satisfies Record<string, HslTriplet>

export const colors = {
  text: {
    primary: hsl(hues.primary, 29, 97),
    primary90: hsla(hues.primary, 29, 97, 0.9),
    primary80: hsla(hues.primary, 29, 97, 0.8),
    primary70: hsla(hues.primary, 29, 97, 0.7),
    primary60: hsla(hues.primary, 29, 97, 0.6),
    primary40: hsla(hues.primary, 29, 97, 0.4),
    primary20: hsla(hues.primary, 29, 97, 0.2),
  },
  accent: {
    wave: hsl(hues.primary, 100, 65),
  },
  border: {
    subtle: hsla(0, 0, 100, 0.12),
    error: hsla(
      feedbackHsl.error.h,
      feedbackHsl.error.s,
      feedbackHsl.error.l,
      0.4,
    ),
  },
  surface: {
    backdrop: hsla(hues.primary, 40, 4, 0.72),
    backdropSoft: hsla(hues.primary, 40, 4, 0.35),
    panel: hsla(0, 0, 0, 0.4),
    panelStrong: hsla(hues.primary, 33, 7, 0.92),
    input: hsla(0, 0, 100, 0.06),
    inputPressed: hsla(0, 0, 100, 0.12),
    card: hsla(209, 34, 12, 0.45),
    headerGradient:
      'linear-gradient(0deg, transparent, hsla(0, 0%, 0%, 0.26), hsla(0, 0%, 0%, 0.9), hsla(0, 0%, 0%, 0.9))',
  },
  feedback: {
    success: hsl(
      feedbackHsl.success.h,
      feedbackHsl.success.s,
      feedbackHsl.success.l,
    ),
    error: hsl(feedbackHsl.error.h, feedbackHsl.error.s, feedbackHsl.error.l),
    successHsl: feedbackHsl.success,
    errorHsl: feedbackHsl.error,
  },
  shadow: {
    base: hsl(0, 0, 0),
    text: hsla(0, 0, 0, 0.55),
  },
  controls: {
    switchTrackOff: hsla(0, 0, 100, 0.15),
    switchThumbOn: hsl(hues.primary, 29, 7),
    pickerTint: hsla(0, 0, 0, 0.1),
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
  iconCircle: 36,
} as const

export const shader = {
  liquidHue: hues.liquid / 360,
  liquidCycleSeconds: 10,
} as const
