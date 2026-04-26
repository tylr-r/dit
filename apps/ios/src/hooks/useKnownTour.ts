import { useCallback, useEffect, useRef, useState } from 'react'

export type TourTarget = 'mode' | 'settings' | 'logo'

export type TourStop = {
  target: TourTarget
  title: string
  caption: string
}

const STOPS: ReadonlyArray<TourStop> = [
  {
    target: 'mode',
    title: 'Modes',
    caption: 'Switch between Practice, Freestyle, and Listen.',
  },
  {
    target: 'settings',
    title: 'Settings',
    caption: 'Tune speed, helpers, reminders, and sync from here.',
  },
  {
    target: 'logo',
    title: 'Progress + chart',
    caption: 'Open your progress and other stats here.',
  },
]

type UseKnownTourArgs = {
  active: boolean
  onFinish: () => void
}

export type UseKnownTour = {
  stopIndex: number
  totalStops: number
  currentStop: TourStop | null
  isFinalStop: boolean
  advance: () => void
}

/** Walks known-track learners through the top-bar controls without relying
 *  on native view measurement for visual targeting. */
export function useKnownTour({ active, onFinish }: UseKnownTourArgs): UseKnownTour {
  const [stopIndex, setStopIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const finishedRef = useRef(false)

  // Reset state every time the tour activates so that replaying the NUX
  // restarts from the first top-bar stop.
  useEffect(() => {
    if (!active) return
    finishedRef.current = false
    setStopIndex(0)
    setFinished(false)
  }, [active])

  const advance = useCallback(() => {
    if (!active) return
    if (finishedRef.current) return
    setStopIndex((prev) => {
      const next = prev + 1
      if (next < STOPS.length) return next

      finishedRef.current = true
      setFinished(true)
      onFinish()
      return prev
    })
  }, [active, onFinish])

  const currentStop: TourStop | null = active && !finished ? STOPS[stopIndex] : null

  return {
    stopIndex,
    totalStops: STOPS.length,
    currentStop,
    isFinalStop: stopIndex === STOPS.length - 1,
    advance,
  }
}
