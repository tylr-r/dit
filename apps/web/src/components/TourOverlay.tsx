import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useScreenTracker } from '../lib/analytics'

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
const CALLOUT_GAP = 12
const CALLOUT_WIDTH = 320
const VIEWPORT_MARGIN = 16

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

const computeCalloutPosition = (rect: NonNullable<Rect>) => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const targetCenterX = rect.left + rect.width / 2
  const halfWidth = CALLOUT_WIDTH / 2
  const minLeft = VIEWPORT_MARGIN
  const maxLeft = viewportWidth - VIEWPORT_MARGIN - CALLOUT_WIDTH
  const left = Math.max(minLeft, Math.min(maxLeft, targetCenterX - halfWidth))
  const belowTop = rect.top + rect.height + SPOTLIGHT_PADDING + CALLOUT_GAP
  const placeBelow = belowTop + 140 < viewportHeight - VIEWPORT_MARGIN
  const top = placeBelow
    ? belowTop
    : Math.max(VIEWPORT_MARGIN, rect.top - SPOTLIGHT_PADDING - CALLOUT_GAP - 140)
  return { top, left }
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

  useScreenTracker('tour')

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
  const calloutPos = rect ? computeCalloutPosition(rect) : null

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
      <div
        className="tour-callout"
        style={
          calloutPos
            ? { top: calloutPos.top, left: calloutPos.left, width: CALLOUT_WIDTH }
            : undefined
        }
      >
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
