const SIGNAL_COLOR = 'var(--color-accent-wave, #ff9d4a)'
const GHOST_COLOR = 'rgba(245,245,245,0.35)'
const ARROW_COLOR = 'rgba(245,245,245,0.3)'
const LABEL_COLOR = 'rgba(245,245,245,0.4)'

const LETTERS = ['K', 'Q', 'Z', 'X', 'J']
const COUNTS = ['x4', 'x3', 'x3', 'x2', 'x1']

/** Slide 1 illustration — weakest letters translate to a mastered letter with waveform. */
export const IntroFluencyIllustration = () => (
  <svg viewBox="0 0 276 180" width="276" height="180" aria-hidden="true">
    <g>
      {LETTERS.map((letter, i) => (
        <text
          key={letter}
          x={20}
          y={36 + i * 26}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={14}
          fill={GHOST_COLOR}
          letterSpacing="0.1em"
        >
          {letter}
        </text>
      ))}
      {COUNTS.map((count, i) => (
        <text
          key={`c-${i}`}
          x={42}
          y={36 + i * 26}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={8}
          fill={GHOST_COLOR}
        >
          {count}
        </text>
      ))}
    </g>
    <g stroke={ARROW_COLOR} strokeWidth={1} fill="none" strokeLinecap="round">
      <line x1={100} y1={88} x2={150} y2={88} />
      <path d="M 144 83 L 150 88 L 144 93" />
    </g>
    <text
      x={185}
      y={78}
      fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
      fontSize={48}
      fontWeight={600}
      fill={SIGNAL_COLOR}
      letterSpacing="-0.02em"
    >
      K
    </text>
    <path
      d="M 178 120 L 192 120 L 192 104 L 204 104 L 204 120 L 216 120 L 216 108 L 228 108 L 228 120 L 246 120 L 246 104 L 258 104 L 258 120"
      fill="none"
      stroke={SIGNAL_COLOR}
      strokeWidth={2}
      strokeLinejoin="miter"
    />
    <text
      x={18}
      y={172}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fontSize={9}
      fill={LABEL_COLOR}
      letterSpacing="0.1em"
    >
      WEAKEST
    </text>
    <text
      x={210}
      y={172}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fontSize={9}
      fill={LABEL_COLOR}
      letterSpacing="0.1em"
    >
      MASTERED
    </text>
  </svg>
)
