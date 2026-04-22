const SIGNAL_COLOR = 'var(--color-accent-wave, #ff9d4a)'
const ARROW_COLOR = 'rgba(245,245,245,0.3)'
const LABEL_COLOR = 'rgba(245,245,245,0.4)'
const TEXT_COLOR = '#f5f5f5'

const CHART_ROWS = [
  { letter: 'A', pattern: '· —' },
  { letter: 'N', pattern: '— ·' },
  { letter: 'R', pattern: '· — ·' },
  { letter: 'T', pattern: '—' },
  { letter: 'E', pattern: '·' },
]

/** Slide 2 illustration — chart table dissolves into a flowing waveform. */
export const IntroListenIllustration = () => (
  <svg viewBox="0 0 276 180" width="276" height="180" aria-hidden="true">
    <g opacity={0.4}>
      {CHART_ROWS.map((row, i) => (
        <text
          key={row.letter}
          x={12}
          y={40 + i * 22}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={10}
          fill={TEXT_COLOR}
          letterSpacing="0.08em"
        >
          {`${row.letter}  ${row.pattern}`}
        </text>
      ))}
    </g>
    <g stroke={ARROW_COLOR} strokeWidth={1} fill="none" strokeLinecap="round">
      <line x1={100} y1={85} x2={150} y2={85} />
      <path d="M 144 80 L 150 85 L 144 90" />
    </g>
    <path
      d="M 160 85 Q 170 85 170 60 Q 170 85 182 85 Q 196 85 196 40 Q 196 85 210 85 Q 222 85 222 115 Q 222 85 236 85 Q 250 85 250 60 Q 250 85 264 85"
      fill="none"
      stroke={SIGNAL_COLOR}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text
      x={12}
      y={170}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fontSize={9}
      fill={LABEL_COLOR}
      letterSpacing="0.1em"
    >
      DECODE
    </text>
    <text
      x={210}
      y={170}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fontSize={9}
      fill={LABEL_COLOR}
      letterSpacing="0.1em"
    >
      HEAR
    </text>
  </svg>
)
