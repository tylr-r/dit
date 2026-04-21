/**
 * Web re-exports of the shared motion primitives. Use `TIMING` in ms for
 * JS-driven animations and `BEZIER` tuples with `cubicBezier()` for inline
 * CSS values. The same names are available as CSS custom properties in
 * `tokens.css` for stylesheet use.
 */
export { BEZIER, cubicBezier, CTA_SLOT_HEIGHT, TIMING } from '@dit/core'
export type { BezierToken, TimingToken } from '@dit/core'
