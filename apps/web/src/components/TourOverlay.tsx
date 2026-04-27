import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type TourStop = {
  target: string
  title: string
  body: string
}

const TOUR_STOPS: readonly TourStop[] = [
  {
    target: 'modes',
    title: 'Modes',
    body: 'Switch between Practice, Freestyle, and Listen.',
  },
  {
    target: 'settings',
    title: 'Settings',
    body: 'Tune speed, helpers, and sync from here.',
  },
  {
    target: 'progress',
    title: 'Progress + chart',
    body: 'Open your progress and the Morse reference from here.',
  },
]

const SPOTLIGHT_PADDING = 8

type TourOverlayProps = {
  onFinish: () => void
}

type Rect = { top: number; left: number; width: number; height: number } | null

const measure = (selector: string): Rect => {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/**
 * Spotlight overlay for the known-user app tour. Highlights real header
 * elements in turn (Modes, Settings, Progress) and advances on tap.
 */
export function TourOverlay({ onFinish }: TourOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const stop = TOUR_STOPS[stepIndex]
  const [rect, setRect] = useState<Rect>(() =>
    measure(`[data-tour-target="${stop.target}"]`),
  )

  useEffect(() => {
    const update = () => {
      setRect(measure(`[data-tour-target="${stop.target}"]`))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [stop.target])

  const handleAdvance = () => {
    if (stepIndex < TOUR_STOPS.length - 1) {
      setStepIndex(stepIndex + 1)
      return
    }
    onFinish()
  }

  if (typeof document === 'undefined') {
    return null
  }

  const spotlight = rect
    ? {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : null

  return createPortal(
    <div
      className="tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={stop.title}
      onClick={handleAdvance}
    >
      {spotlight ? (
        <div
          className="tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="tour-callout">
        <div className="tour-callout-title">{stop.title}</div>
        <div className="tour-callout-body">{stop.body}</div>
        <div className="tour-callout-meta">
          <div className="tour-dots" aria-hidden="true">
            {TOUR_STOPS.map((_, index) => (
              <span
                key={index}
                className={`tour-dot ${index === stepIndex ? 'is-active' : ''}`}
              />
            ))}
          </div>
          <div className="tour-callout-cta">
            {stepIndex === TOUR_STOPS.length - 1 ? 'Finish' : 'Next'} ›
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
