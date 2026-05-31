import {
  type AnalyticsClient,
  type AnalyticsEventName,
  type AnalyticsEventParams,
  type Mode,
  type ScreenName,
  noopAnalyticsClient,
} from '@dit/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApp } from '@react-native-firebase/app'
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setUserId,
  setUserProperty,
} from '@react-native-firebase/analytics'
import { useEffect, useRef } from 'react'

let analyticsEnabledForTests: boolean | null = null

const isFalsy = (value: string | undefined) =>
  value === '0' || value === 'false' || value === 'no'

export const isAnalyticsEnabled = () => {
  if (analyticsEnabledForTests !== null) {
    return analyticsEnabledForTests
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return false
  }

  if (process.env.NODE_ENV === 'test') {
    return false
  }

  return !isFalsy(process.env.EXPO_PUBLIC_ANALYTICS_ENABLED)
}

export const setAnalyticsEnabledForTests = (enabled: boolean | null) => {
  analyticsEnabledForTests = enabled
}

/**
 * iOS analytics client backed by Firebase Analytics via @react-native-firebase.
 * Uses the modular v22 API. Falls back to a no-op when the native module
 * isn't available (unit tests, Storybook web runner, etc.).
 */
const createClient = (): AnalyticsClient => {
  try {
    const instance = getAnalytics(getApp())
    return {
      logEvent: (name, ...params) => {
        if (!isAnalyticsEnabled()) {
          return
        }
        // Cast name to string to avoid Firebase's CustomEventName<T> constraint,
        // which rejects names that overlap with Firebase reserved event names.
        logEvent(instance, name as string, params[0]).catch(() => {})
      },
      setUserId: (id) => {
        if (!isAnalyticsEnabled()) {
          return
        }
        setUserId(instance, id).catch(() => {})
      },
      setUserProperty: (name, value) => {
        if (!isAnalyticsEnabled()) {
          return
        }
        setUserProperty(instance, name, value).catch(() => {})
      },
    }
  } catch {
    return noopAnalyticsClient
  }
}

export const analyticsClient: AnalyticsClient = createClient()

const MILESTONE_PREFIX = 'dit:milestone:'
const firedMilestones = new Set<string>()

const isMode = (value: unknown): value is Mode =>
  value === 'practice' || value === 'freestyle' || value === 'listen'

/** Run `fire` exactly once per `name`, persisted via AsyncStorage. */
export const fireOnce = (name: string, fire: () => void) => {
  if (!isAnalyticsEnabled()) {
    return
  }

  const key = `${MILESTONE_PREFIX}${name}`
  if (firedMilestones.has(key)) {
    return
  }
  firedMilestones.add(key)
  AsyncStorage.getItem(key)
    .then((value) => {
      if (value === '1') {
        return
      }
      return AsyncStorage.setItem(key, '1').then(fire)
    })
    .catch(() => {
      firedMilestones.delete(key)
    })
}

export const resetAnalyticsMilestonesForTests = () => {
  firedMilestones.clear()
}

const trackScreenView = (screen: ScreenName) => {
  if (!isAnalyticsEnabled()) {
    return
  }

  analyticsClient.logEvent('screen_view', { screen })
  try {
    const instance = getAnalytics(getApp())
    logScreenView(instance, {
      screen_name: screen,
      screen_class: screen,
    }).catch(() => {})
  } catch {
    // Firebase is unavailable in tests and Storybook; the custom event above
    // still gives us a safe typed fallback through the no-op client.
  }
}

type LogAnalyticsEvent = {
  <N extends AnalyticsEventName>(
    name: N,
    ...params: AnalyticsEventParams<N> extends undefined | never
      ? []
      : [AnalyticsEventParams<N>]
  ): void
  (name: string, params?: Record<string, unknown>): void
}

export const logAnalyticsEvent: LogAnalyticsEvent = (
  name: string,
  params?: Record<string, unknown>,
) => {
  if (!isAnalyticsEnabled()) {
    return
  }

  if (name === 'mode_correct_answer') {
    if (params && isMode(params.mode)) {
      const mode = params.mode
      fireOnce(`first_correct_letter:${mode}`, () => {
        analyticsClient.logEvent('first_correct_letter', { mode })
      })
    }
    return
  }

  ;(analyticsClient.logEvent as (event: string, params?: Record<string, unknown>) => void)(
    name,
    params,
  )

  if (name === 'mode_start' && params && isMode(params.mode)) {
    const mode = params.mode
    fireOnce(`first_mode_session:${mode}`, () => {
      analyticsClient.logEvent('first_mode_session', { mode })
    })
  }
}

/** Tracks native screen views/exits and sets Firebase screen name/class. */
export const useAnalyticsScreenTracker = (screen: ScreenName) => {
  const mountedAtRef = useRef(0)

  useEffect(() => {
    mountedAtRef.current = Date.now()
    trackScreenView(screen)

    return () => {
      if (!isAnalyticsEnabled()) {
        return
      }
      analyticsClient.logEvent('screen_exit', {
        screen,
        duration_ms: Date.now() - mountedAtRef.current,
      })
    }
  }, [screen])
}
