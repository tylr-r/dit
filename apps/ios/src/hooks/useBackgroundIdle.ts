import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BACKGROUND_IDLE_TIMEOUT_MS,
  clearTimer,
  type TimeoutHandle,
} from '../utils/appState'

/** Marks the app background animation idle until the next user interaction. */
export const useBackgroundIdle = () => {
  const [isBackgroundIdle, setIsBackgroundIdle] = useState(false)
  const backgroundIdleTimeoutRef = useRef<TimeoutHandle | null>(null)
  const isBackgroundIdleRef = useRef(false)

  const scheduleBackgroundIdle = useCallback(() => {
    clearTimer(backgroundIdleTimeoutRef)
    backgroundIdleTimeoutRef.current = setTimeout(() => {
      isBackgroundIdleRef.current = true
      setIsBackgroundIdle(true)
    }, BACKGROUND_IDLE_TIMEOUT_MS)
  }, [])

  const registerAppInteraction = useCallback(() => {
    if (isBackgroundIdleRef.current) {
      isBackgroundIdleRef.current = false
      setIsBackgroundIdle(false)
    }
    scheduleBackgroundIdle()
  }, [scheduleBackgroundIdle])

  const handleRootTouchStart = useCallback(() => {
    registerAppInteraction()
    return false
  }, [registerAppInteraction])

  useEffect(() => {
    registerAppInteraction()
    return () => {
      clearTimer(backgroundIdleTimeoutRef)
    }
  }, [registerAppInteraction])

  return {
    isBackgroundIdle,
    handleRootTouchStart,
    registerAppInteraction,
  }
}
