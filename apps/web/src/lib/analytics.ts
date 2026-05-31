import { useEffect, useRef } from 'react'
import {
  createLooseAnalyticsLogger,
  withAnalyticsContext,
  type AnalyticsClient,
  type ScreenName,
} from '@dit/core'

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? ''
const APP_SURFACE = 'web'

let analyticsEnabledForTests: boolean | null = null

const isFalsy = (value: string | undefined) =>
  value === '0' || value === 'false' || value === 'no'

export const isAnalyticsEnabled = () => {
  if (analyticsEnabledForTests !== null) {
    return analyticsEnabledForTests
  }

  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return false
  }

  return !isFalsy(import.meta.env.VITE_ANALYTICS_ENABLED)
}

export const setAnalyticsEnabledForTests = (enabled: boolean | null) => {
  analyticsEnabledForTests = enabled
}

const callGtag = (...args: unknown[]) => {
  if (!isAnalyticsEnabled() || typeof window === 'undefined' || !window.gtag) {
    return
  }
  window.gtag(...args)
}

const emitEvent = (event: string, params?: Record<string, unknown>) => {
  callGtag('event', event, withAnalyticsContext(APP_SURFACE, params))
}

export const analytics: AnalyticsClient = {
  logEvent(name, ...params) {
    emitEvent(name, params[0])
  },
  setUserId(id) {
    callGtag('config', GA_ID, { user_id: id ?? undefined })
  },
  setUserProperty(name, value) {
    callGtag('set', 'user_properties', { [name]: value ?? undefined })
  },
}

const MILESTONE_PREFIX = 'dit:milestone:'

/** Run `fire` exactly once per `name`, persisted via localStorage. */
export const fireOnce = (name: string, fire: () => void) => {
  if (!isAnalyticsEnabled() || typeof window === 'undefined') {
    return
  }
  const key = `${MILESTONE_PREFIX}${name}`
  try {
    if (window.localStorage.getItem(key) === '1') {
      return
    }
    window.localStorage.setItem(key, '1')
  } catch {
    return
  }
  fire()
}

/**
 * Loose-callback shim for legacy hook props that expect
 * `(event: string, params?: Record<string, unknown>) => void`. Prefer
 * `analytics.logEvent` (typed) for any new direct call site; this shim
 * exists only so the controller and onboarding hooks can keep their
 * existing prop signatures.
 *
 * The shim also translates two internal-only signals:
 * - `mode_start` → fires the source event AND a one-time
 *   `first_mode_session` per mode (gated via `fireOnce` + localStorage).
 * - `mode_correct_answer` → does NOT forward to GA. Translates to a
 *   one-time `first_correct_letter` per mode. The source signal name is
 *   intentionally absent from the typed `AnalyticsEvent` union; it's a
 *   loose contract between the core controller and this adapter.
 */
export const logEvent = createLooseAnalyticsLogger(emitEvent, fireOnce)

/** Tracks screen view and exit events, including visibility-change awareness. */
export const useScreenTracker = (screen: ScreenName) => {
  const mountedAtRef = useRef<number>(0)
  const visibleRef = useRef<boolean>(true)

  useEffect(() => {
    const isVisibleNow =
      typeof document === 'undefined' || document.visibilityState === 'visible'
    visibleRef.current = isVisibleNow
    mountedAtRef.current = Date.now()
    if (isVisibleNow) {
      analytics.logEvent('screen_view', { screen })
    }

    const onVisibility = () => {
      const nowVisible = document.visibilityState === 'visible'
      if (visibleRef.current && !nowVisible) {
        analytics.logEvent('screen_exit', {
          screen,
          duration_ms: Date.now() - mountedAtRef.current,
        })
      } else if (!visibleRef.current && nowVisible) {
        mountedAtRef.current = Date.now()
        analytics.logEvent('screen_view', { screen })
      }
      visibleRef.current = nowVisible
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
      if (visibleRef.current) {
        analytics.logEvent('screen_exit', {
          screen,
          duration_ms: Date.now() - mountedAtRef.current,
        })
      }
    }
  }, [screen])
}
