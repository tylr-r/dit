import type { ReactNode } from 'react'
import type { Letter } from '../data/morse'

type StageDisplayProps = {
  freestyleDisplay: string
  hasFreestyleDisplay: boolean
  hintVisible: boolean
  isFreestyle: boolean
  isListen: boolean
  letter: Letter
  listenDisplay: string
  listenDisplayClass: string
  listenStatusText: string
  pips: ReactNode
  statusText: string
  target: string
}

/** Main output area for freestyle, listen, and character modes. */
export function StageDisplay({
  freestyleDisplay,
  hasFreestyleDisplay,
  hintVisible,
  isFreestyle,
  isListen,
  letter,
  listenDisplay,
  listenDisplayClass,
  listenStatusText,
  pips,
  statusText,
  target,
}: StageDisplayProps) {
  return (
    <main className="stage">
      {isFreestyle ? (
        <div
          className={`letter ${
            hasFreestyleDisplay ? '' : 'letter-placeholder'
          }`}
          aria-live="polite"
        >
          {freestyleDisplay}
        </div>
      ) : isListen ? (
        <>
          <div key={letter} className={listenDisplayClass} aria-live="polite">
            {listenDisplay}
          </div>
          <p className="status-text" aria-live="polite">
            {listenStatusText}
          </p>
        </>
      ) : (
        <>
          <div key={letter} className="letter">
            {letter}
          </div>
          {hintVisible ? (
            <div className="progress" aria-label={`Target ${target}`}>
              {pips}
            </div>
          ) : (
            <div className="progress progress-hidden" aria-hidden="true" />
          )}
          <p className="status-text" aria-live="polite">
            {statusText}
          </p>
        </>
      )}
    </main>
  )
}
