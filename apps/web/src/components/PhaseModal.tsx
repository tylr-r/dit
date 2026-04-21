import type { PhaseModalContent } from '@dit/core'
import { useCallback, useEffect } from 'react'

type PhaseModalProps = {
  content: PhaseModalContent
  onDismiss: () => void
}

/** Overlay shown at guided-course phase transitions (teach → practice → listen). */
export function PhaseModal({ content, onDismiss }: PhaseModalProps) {
  const handleDismiss = useCallback(() => {
    onDismiss()
  }, [onDismiss])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault()
        handleDismiss()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [handleDismiss])

  return (
    <div className="phase-modal-overlay" onClick={handleDismiss} role="presentation">
      <div
        className="phase-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phase-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="phase-modal-title" className="phase-modal-title">
          {content.title}
        </p>
        {content.subtitle ? (
          <p className="phase-modal-subtitle">{content.subtitle}</p>
        ) : null}
        {content.letters && content.letters.length > 0 ? (
          <div className="phase-modal-letters">
            {content.letters.map((letter) => (
              <div key={letter} className="phase-modal-chip">
                {letter}
              </div>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="phase-modal-button"
          onClick={handleDismiss}
          autoFocus
        >
          {content.buttonText ?? 'Continue'}
        </button>
      </div>
    </div>
  )
}
