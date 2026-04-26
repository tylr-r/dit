import { useState } from 'react'
import type { LearningSheetProps } from './componentProps'

type View = 'course' | 'open' | 'custom'

type Tier = {
  level: number
  title: string
  subtitle: string
}

const TIERS: readonly Tier[] = [
  { level: 1, title: 'Beginner letters', subtitle: 'A E I M N T' },
  { level: 2, title: 'Common letters', subtitle: 'adds D G K O R S U W' },
  { level: 3, title: 'Full alphabet', subtitle: 'adds B C F H J L P Q V X Y Z' },
  { level: 4, title: 'Full alphabet + digits', subtitle: 'adds 0 1 2 3 4 5 6 7 8 9' },
]

/** Modal sheet for selecting a guided course pack or open-practice letter set. */
export function LearningSheet({
  guidedCourseActive,
  customLetters,
  maxLevel,
  onClose,
  onSelectTier,
  onSetGuidedCourseActive,
}: LearningSheetProps) {
  const [view, setView] = useState<View>(
    guidedCourseActive ? 'course' : 'open',
  )

  const handleSegmentChange = (next: 'course' | 'open') => {
    setView(next)
    if (next === 'course' && !guidedCourseActive) {
      onSetGuidedCourseActive(true)
    } else if (next === 'open' && guidedCourseActive) {
      onSetGuidedCourseActive(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal learning-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Learning method"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">Learning method</div>
          <div className="modal-actions">
            <button type="button" className="modal-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="learning-segments" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'course'}
            className={`learning-segment ${view === 'course' ? 'is-active' : ''}`}
            onClick={() => handleSegmentChange('course')}
          >
            Course
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'open'}
            className={`learning-segment ${view === 'open' ? 'is-active' : ''}`}
            onClick={() => handleSegmentChange('open')}
          >
            Open practice
          </button>
        </div>
        <div className="learning-body">
          {view === 'course' ? (
            <div data-testid="learning-course-placeholder">Course view</div>
          ) : view === 'open' ? (
            <ul className="learning-list" role="list">
              {TIERS.map((tier) => {
                const isSelected = customLetters.length === 0 && maxLevel === tier.level
                return (
                  <li key={tier.level}>
                    <button
                      type="button"
                      className={`learning-row ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => {
                        onSelectTier(tier.level)
                        onClose()
                      }}
                    >
                      <span className="learning-row-text">
                        <span className="learning-row-title">{tier.title}</span>
                        <span className="learning-row-subtitle">{tier.subtitle}</span>
                      </span>
                      {isSelected ? (
                        <span className="learning-row-check" aria-label="Selected">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  className={`learning-row ${customLetters.length > 0 ? 'is-selected' : ''}`}
                  onClick={() => setView('custom')}
                >
                  <span className="learning-row-text">
                    <span className="learning-row-title">Pick your own</span>
                    <span className="learning-row-subtitle">
                      {customLetters.length > 0
                        ? `${customLetters.length} character${customLetters.length === 1 ? '' : 's'} selected`
                        : 'Choose individual letters and digits'}
                    </span>
                  </span>
                  <span className="learning-row-chevron">›</span>
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
