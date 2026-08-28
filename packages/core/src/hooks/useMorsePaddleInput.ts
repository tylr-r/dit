import { useCallback, useEffect, useMemo, useRef } from 'react'
import { clearTimer, type TimeoutHandle } from '../utils/appState'

export type MorsePaddleSymbol = '.' | '-'

export type UseMorsePaddleInputOptions = {
  canStart: () => boolean
  getUnitMs: () => number
  startTone: () => void
  stopTone: () => void
  onSymbol: (symbol: MorsePaddleSymbol) => void
  onActiveChange: (active: boolean) => void
}

/**
 * Owns timed dit/dah paddle playback, held-key repeat, paddle switching,
 * release, and cancellation for every Morse input surface.
 */
export const useMorsePaddleInput = (
  options: UseMorsePaddleInputOptions,
) => {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const pressedRef = useRef<MorsePaddleSymbol | null>(null)
  const activeRef = useRef<MorsePaddleSymbol | null>(null)
  const timerRef = useRef<TimeoutHandle | null>(null)
  const runCycleRef = useRef<(symbol: MorsePaddleSymbol) => void>(() => {})

  const runCycle = useCallback((symbol: MorsePaddleSymbol) => {
    if (pressedRef.current !== symbol || !optionsRef.current.canStart()) {
      return
    }
    const unitMs = optionsRef.current.getUnitMs()
    const toneMs = symbol === '.' ? unitMs : unitMs * 3
    activeRef.current = symbol
    optionsRef.current.onActiveChange(true)
    optionsRef.current.startTone()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (activeRef.current !== symbol) {
        return
      }
      activeRef.current = null
      optionsRef.current.onActiveChange(false)
      optionsRef.current.stopTone()
      optionsRef.current.onSymbol(symbol)
      const nextSymbol = pressedRef.current
      if (nextSymbol) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          runCycleRef.current(nextSymbol)
        }, unitMs)
      }
    }, toneMs)
  }, [])

  useEffect(() => {
    runCycleRef.current = runCycle
  }, [runCycle])

  const pressIn = useCallback((symbol: MorsePaddleSymbol) => {
    if (!optionsRef.current.canStart()) {
      return false
    }
    pressedRef.current = symbol
    if (activeRef.current === null) {
      clearTimer(timerRef)
      runCycleRef.current(symbol)
    }
    return true
  }, [])

  const pressOut = useCallback((symbol: MorsePaddleSymbol) => {
    if (pressedRef.current !== symbol && activeRef.current !== symbol) {
      return false
    }
    if (pressedRef.current === symbol) {
      pressedRef.current = null
    }
    if (activeRef.current === null && pressedRef.current === null) {
      clearTimer(timerRef)
    }
    return true
  }, [])

  const cancel = useCallback(() => {
    const wasActive = activeRef.current !== null
    pressedRef.current = null
    activeRef.current = null
    clearTimer(timerRef)
    if (wasActive) {
      optionsRef.current.onActiveChange(false)
      optionsRef.current.stopTone()
    }
  }, [])

  useEffect(() => cancel, [cancel])

  return useMemo(
    () => ({ pressIn, pressOut, cancel }),
    [cancel, pressIn, pressOut],
  )
}
