import type { GuidedPhase } from './types'
import type { Mode } from './hooks/useProgressSyncController'
import type { NuxStep } from './utils/appState'

export type AppSurface = 'ios' | 'web'

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
export type LearningMethod = 'course' | 'open_practice'
export type LearningScopeSelectedParams =
  | {
      method: 'course'
      scope: 'course_pack'
      pack_index: number
      pack_number: number
    }
  | {
      method: 'open_practice'
      scope: 'tier'
      level: number
    }
  | {
      method: 'open_practice'
      scope: 'custom_letters'
      character_count: number
    }

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
      name: 'learning_method_opened'
      params: { active_method: LearningMethod }
    }
  | {
      name: 'learning_method_selected'
      params: { method: LearningMethod; previous_method: LearningMethod }
    }
  | {
      name: 'learning_scope_selected'
      params: LearningScopeSelectedParams
    }
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

type LooseAnalyticsEmitter = (
  event: string,
  params?: Record<string, unknown>,
) => void

type FireAnalyticsOnce = (key: string, fire: () => void) => void

export const withAnalyticsContext = (
  appSurface: AppSurface,
  params?: Record<string, unknown>,
) => ({
  ...(params ?? {}),
  app_surface: appSurface,
})

export const createLooseAnalyticsLogger = (
  emit: LooseAnalyticsEmitter,
  fireOnce: FireAnalyticsOnce,
) => {
  return (event: string, params?: Record<string, unknown>) => {
    if (event === 'mode_correct_answer') {
      if (params && typeof params.mode === 'string') {
        const mode = params.mode
        fireOnce(`first_correct_letter:${mode}`, () => {
          emit('first_correct_letter', { mode })
        })
      }
      return
    }

    emit(event, params)

    if (event === 'mode_start' && params && typeof params.mode === 'string') {
      const mode = params.mode
      fireOnce(`first_mode_session:${mode}`, () => {
        emit('first_mode_session', { mode })
      })
    }
  }
}

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
