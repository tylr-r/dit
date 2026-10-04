import type { CSSProperties } from 'react'

const SEQUENCE = ['N', 'R', 'A', 'T', 'E']
// Duplicate the edge letters so the last frame and the first look identical.
const LETTERS = Array.from({ length: 12 }, (_, index) => SEQUENCE[(index + 2) % 5])
const slots = [
  { x: -30, scale: 0.32, opacity: 0 },
  { x: 48, scale: 0.32, opacity: 0.2 },
  { x: 126, scale: 0.43, opacity: 0.4 },
  { x: 240, scale: 1, opacity: 1 },
  { x: 354, scale: 0.43, opacity: 0.4 },
  { x: 432, scale: 0.32, opacity: 0.2 },
  { x: 510, scale: 0.32, opacity: 0 },
]

const position = (offset: number) => slots[Math.max(0, Math.min(6, offset + 3))]

/** A continuous recognition sequence with letters recycled outside the visible slots. */
export const IntroFluencyIllustration = () => (
  <svg viewBox="0 0 480 280" aria-hidden="true" className="nux-recognition-art">
    <g textAnchor="middle" dominantBaseline="central" fontWeight="600" fontSize="148">
      {LETTERS.map((letter, index) => {
        const style: Record<string, string | number> = {}
        for (let step = 0; step <= 5; step += 1) {
          const name = `step-${step}`
          const active = step + 3
          const slot = position(index - active)
          style[`--${name}-position`] = `translate(${slot.x}px, 130px) scale(${slot.scale})`
          style[`--${name}-opacity`] = slot.opacity
          style[`--${name}-color`] = index === active
            ? 'var(--color-accent-wave)'
            : 'var(--color-text-primary)'
        }
        return (
          <g key={`${letter}-${index}`} className="nux-recognition-letter" style={style as CSSProperties}>
            <text>{letter}</text>
          </g>
        )
      })}
    </g>
    <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path className="nux-recognition-feedback nux-recognition-first" pathLength="1" d="m229 234 8 8 15-17" stroke="var(--color-feedback-success)" />
      <path className="nux-recognition-feedback nux-recognition-miss" pathLength="1" d="m232 226 16 16m0-16-16 16" stroke="var(--color-feedback-error)" />
      <path className="nux-recognition-feedback nux-recognition-last" pathLength="1" d="m229 234 8 8 15-17" stroke="var(--color-feedback-success)" />
    </g>
  </svg>
)
