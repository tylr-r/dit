/**
 * Interactive button for morse code input. Tap for dot, hold for dah.
 * Features a liquid/gel-style appearance with SVG displacement filters.
 */

import type { SyntheticEvent } from 'react'
import './MorseButton.css'
import type { MorseButtonProps } from './componentProps'

/** Tap/press input button for dot/dah entry. */
export function MorseButton({
  buttonRef,
  isPressing,
  onBlur,
  onKeyDown,
  onKeyUp,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerUp,
}: MorseButtonProps) {
  const preventDefault = (event: SyntheticEvent) => {
    event.preventDefault()
  }

  return (
    <div className="morse-button-wrap">
      {/* SVG filters for liquid effect */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="fluid" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.003 0.003"
            numOctaves={1}
            seed={5}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={50}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter id="fluidActive" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.003 0.003"
            numOctaves={1}
            seed={5}
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="8s"
              values="0.003 0.003;0.004 0.002;0.002 0.004;0.003 0.003"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={60}
            xChannelSelector="R"
            yChannelSelector="G"
          >
            <animate
              attributeName="scale"
              dur="6s"
              values="60;75;55;70;60"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
              repeatCount="indefinite"
            />
          </feDisplacementMap>
        </filter>
      </svg>

      <button
        type="button"
        className={`morse-button ${isPressing ? 'pressing' : ''}`}
        ref={buttonRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onContextMenu={preventDefault}
        onDoubleClick={preventDefault}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
        aria-label="Tap for dot, hold for dah"
      >
        <span className="fluid-container" aria-hidden="true">
          <span className="fluid-paint" />
        </span>
        <span className="fluid-glow" aria-hidden="true" />
        <span className="fluid-glass" aria-hidden="true" />
      </button>
    </div>
  )
}
