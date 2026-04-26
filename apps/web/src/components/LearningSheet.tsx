import { useState } from 'react'
import type { LearningSheetProps } from './componentProps'

type View = 'course' | 'open' | 'custom'

/** Modal sheet for selecting a guided course pack or open-practice letter set. */
export function LearningSheet({
  guidedCourseActive,
  onClose,
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
            <div data-testid="learning-open-placeholder">Open practice view</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
