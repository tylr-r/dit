import type { GuidedPhase } from './types'
import type { Mode } from './hooks/useProgressSyncController'
import type { NuxStep } from './utils/appState'

export type ScreenName =
  | 'practice'
  | 'freestyle'
  | 'listen'
  | 'settings'
  | 'learning'
  | 'reference'
  | 'sign_in'
  | 'nux'
  | 'tour'
  | 'phase_modal'

export type SettingChangeValue = string | number | boolean

/** Typed event vocabulary for product analytics. */
export type AnalyticsEvent =
  | { name: 'mode_start'; params: { mode: Mode } }
  | { name: 'onboarding_completed'; params?: never }
  | { name: 'streak_day_reached'; params: { streak_length: number } }
  | { name: 'nux_step_view'; params: { step: NuxStep } }
  | {
      name: 'nux_step_complete'
      params: { step: NuxStep; time_on_step_ms: number }
    }
  | { name: 'nux_step_skipped'; params: { step: NuxStep } }
  | { name: 'screen_view'; params: { screen: ScreenName } }
  | {
      name: 'screen_exit'
      params: { screen: ScreenName; duration_ms: number }
    }
  | { name: 'first_mode_session'; params: { mode: Mode } }
  | { name: 'first_correct_letter'; params: { mode: Mode } }
  | {
      name: 'guided_phase_advance'
      params: { from_phase: GuidedPhase; to_phase: GuidedPhase }
    }
  | { name: 'guided_phase_complete'; params: { phase: GuidedPhase } }
  | {
      name: 'setting_changed'
      params: { setting: string; value: SettingChangeValue }
    }
  | { name: 'phase_modal_dismissed'; params: { phase?: GuidedPhase } }
  | { name: 'sound_check'; params?: never }

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
