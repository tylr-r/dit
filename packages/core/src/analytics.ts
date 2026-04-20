/** Typed event vocabulary for basic product analytics. */
export type AnalyticsEvent =
  | { name: 'mode_start'; params: { mode: 'practice' | 'freestyle' | 'listen' } }
  | { name: 'onboarding_completed'; params?: never }
  | { name: 'streak_day_reached'; params: { streak_length: number } }

export type AnalyticsEventName = AnalyticsEvent['name']

export type AnalyticsEventParams<N extends AnalyticsEventName> = Extract<
  AnalyticsEvent,
  { name: N }
>['params']

export interface AnalyticsClient {
  logEvent<N extends AnalyticsEventName>(
    name: N,
    ...params: AnalyticsEventParams<N> extends undefined | never
      ? []
      : [AnalyticsEventParams<N>]
  ): void
  setUserId(id: string | null): void
  setUserProperty(name: string, value: string | null): void
}

/** No-op client used as a safe default / test stub. */
export const noopAnalyticsClient: AnalyticsClient = {
  logEvent: () => {},
  setUserId: () => {},
  setUserProperty: () => {},
}
