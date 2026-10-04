/** Whole letters tighten their spacing in place without revealing Morse patterns. */
export const IntroSpeedIllustration = () => (
  <svg viewBox="0 0 480 280" aria-hidden="true" className="nux-spacing-art">
    <g textAnchor="middle" dominantBaseline="central" fontSize="64" fontWeight="600" fill="var(--color-accent-wave)">
      <text className="nux-spacing-left" x="176" y="140">T</text>
      <text x="240" y="140">E</text>
      <text className="nux-spacing-right" x="304" y="140">N</text>
    </g>
    <g textAnchor="middle" fontSize="15" fill="var(--color-text-primary-70)">
      <text className="nux-spacing-more" x="240" y="199">More space</text>
      <text className="nux-spacing-less" x="240" y="199">Less space</text>
    </g>
  </svg>
)
