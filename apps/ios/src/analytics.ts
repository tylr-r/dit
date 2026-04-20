import {
  type AnalyticsClient,
  type AnalyticsEventName,
  type AnalyticsEventParams,
  noopAnalyticsClient,
} from '@dit/core'
import analytics from '@react-native-firebase/analytics'

/**
 * iOS analytics client backed by Firebase Analytics via @react-native-firebase.
 * Falls back to a no-op in environments where the native module isn't available
 * (unit tests, Storybook web runner, etc.).
 */
const createClient = (): AnalyticsClient => {
  try {
    const instance = analytics()
    return {
      logEvent: (name, ...params) => {
        instance.logEvent(name, params[0]).catch(() => {})
      },
      setUserId: (id) => {
        instance.setUserId(id).catch(() => {})
      },
      setUserProperty: (name, value) => {
        instance.setUserProperty(name, value).catch(() => {})
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
