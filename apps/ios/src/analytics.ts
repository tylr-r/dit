import {
  type AnalyticsClient,
  type AnalyticsEventName,
  type AnalyticsEventParams,
  noopAnalyticsClient,
  withAnalyticsContext,
} from '@dit/core'
import { getApp } from '@react-native-firebase/app'
import {
  getAnalytics,
  logEvent,
  setUserId,
  setUserProperty,
} from '@react-native-firebase/analytics'

const APP_SURFACE = 'ios'

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
        // Cast name to string to avoid Firebase's CustomEventName<T> constraint,
        // which rejects names that overlap with Firebase reserved event names.
        logEvent(
          instance,
          name as string,
          withAnalyticsContext(APP_SURFACE, params[0]),
        ).catch(() => {})
      },
      setUserId: (id) => {
        setUserId(instance, id).catch(() => {})
      },
      setUserProperty: (name, value) => {
        setUserProperty(instance, name, value).catch(() => {})
      },
    }
  } catch {
    return noopAnalyticsClient
  }
}

export const analyticsClient: AnalyticsClient = createClient()

export const logAnalyticsEvent = <N extends AnalyticsEventName>(
  name: N,
  ...params: AnalyticsEventParams<N> extends undefined | never
    ? []
    : [AnalyticsEventParams<N>]
) => {
  analyticsClient.logEvent(name, ...params)
}
