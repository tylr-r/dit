import { useEffect, useRef } from 'react'
import type { NuxStep } from '../utils/appState'

type LogEvent = (name: string, params?: Record<string, unknown>) => void

/**
 * Watches `nuxStep` and emits `nux_step_view` on each entry plus
 * `nux_step_complete` (with elapsed time) on each advance. Inactive
 * mode (`isActive=false`) suppresses events and resets internal state
 * so a future activation starts fresh.
 */
export const useNuxStepTracker = (
  nuxStep: NuxStep,
  isActive: boolean,
  log: LogEvent,
) => {
  const prevStepRef = useRef<NuxStep | null>(null)
  const enteredAtRef = useRef<number>(0)
  const logRef = useRef(log)

  useEffect(() => {
    logRef.current = log
  }, [log])

  useEffect(() => {
    if (!isActive) {
      prevStepRef.current = null
      return
    }
    if (prevStepRef.current === nuxStep) {
      return
    }
    if (prevStepRef.current !== null) {
      logRef.current('nux_step_complete', {
        step: prevStepRef.current,
        time_on_step_ms: Date.now() - enteredAtRef.current,
      })
    }
    logRef.current('nux_step_view', { step: nuxStep })
    prevStepRef.current = nuxStep
    enteredAtRef.current = Date.now()
  }, [isActive, nuxStep])
}
