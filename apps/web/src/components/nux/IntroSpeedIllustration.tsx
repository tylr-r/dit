const SIGNAL_COLOR = 'var(--color-accent-wave, #ff9d4a)'
const GHOST_COLOR = 'rgba(245,245,245,0.4)'
const ARROW_COLOR = 'rgba(245,245,245,0.3)'
const LABEL_COLOR = 'rgba(245,245,245,0.4)'

/**
 * Slide 3 illustration — top row (wide gaps, ghost) over bottom row (tight gaps, signal).
 * The CSS class `nux-intro-speed-signal` on the bottom group drives the gap-compression
 * animation (defined in App.css).
 */
export const IntroSpeedIllustration = () => (
  <svg viewBox="0 0 276 180" width="276" height="180" aria-hidden="true">
    <text
      x={10}
      y={24}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fontSize={9}
      fill={LABEL_COLOR}
      letterSpacing="0.1em"
    >
      12 / 8 WPM
    </text>
    <g fill={GHOST_COLOR}>
      <rect x={10} y={36} width={14} height={5} />
      <rect x={27} y={36} width={4} height={5} />
      <rect x={72} y={36} width={4} height={5} />
      <rect x={79} y={36} width={14} height={5} />
      <rect x={96} y={36} width={4} height={5} />
      <rect x={148} y={36} width={4} height={5} />
      <rect x={155} y={36} width={14} height={5} />
      <rect x={216} y={36} width={14} height={5} />
    </g>
    <g stroke={ARROW_COLOR} strokeWidth={1} fill="none" strokeLinecap="round">
      <line x1={138} y1={68} x2={138} y2={112} />
      <path d="M 133 106 L 138 112 L 143 106" />
    </g>
    <g className="nux-intro-speed-signal" fill={SIGNAL_COLOR}>
      <rect x={48} y={136} width={14} height={5} />
      <rect x={65} y={136} width={4} height={5} />
      <rect x={82} y={136} width={4} height={5} />
      <rect x={89} y={136} width={14} height={5} />
      <rect x={106} y={136} width={4} height={5} />
      <rect x={123} y={136} width={4} height={5} />
      <rect x={130} y={136} width={14} height={5} />
      <rect x={157} y={136} width={14} height={5} />
    </g>
    <text
      x={10}
      y={160}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fontSize={9}
      fill={LABEL_COLOR}
      letterSpacing="0.1em"
    >
      12 / 12 WPM
    </text>
  </svg>
)
