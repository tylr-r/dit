import {
  type AnalyticsClient,
  type AnalyticsEventName,
  type AnalyticsEventParams,
  createLooseAnalyticsLogger,
  type ScreenName,
  noopAnalyticsClient,
  withAnalyticsContext,
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

const APP_SURFACE = 'ios'
const MILESTONE_PREFIX = 'dit:milestone:'

let analyticsEnabledForTests: boolean | null = null
const firedMilestones = new Set<string>()

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
        logEvent(
          instance,
          name as string,
          withAnalyticsContext(APP_SURFACE, params[0]),
        ).catch(() => {})
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

type LogAnalyticsEvent = {
  <N extends AnalyticsEventName>(
    name: N,
    ...params: AnalyticsEventParams<N> extends undefined | never
      ? []
      : [AnalyticsEventParams<N>]
  ): void
  (name: string, params?: Record<string, unknown>): void
}

export const logAnalyticsEvent = createLooseAnalyticsLogger(
  (event, params) => {
    ;(analyticsClient.logEvent as (name: string, params?: Record<string, unknown>) => void)(
      event,
      params,
    )
  },
  fireOnce,
) as LogAnalyticsEvent

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
