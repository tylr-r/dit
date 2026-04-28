import { describe, expect, it } from 'vitest'
import {
  noopAnalyticsClient,
  type AnalyticsEvent,
  type AnalyticsEventName,
} from '../../src/analytics'

/**
 * Exhaustive sample of every AnalyticsEvent variant. The mapped type
 * forces every event name in the union to have an entry; adding a new
 * variant to AnalyticsEvent without updating this map is a compile error.
 */
const SAMPLES: { [N in AnalyticsEventName]: Extract<AnalyticsEvent, { name: N }> } = {
  mode_start: { name: 'mode_start', params: { mode: 'practice' } },
  onboarding_completed: { name: 'onboarding_completed' },
  streak_day_reached: { name: 'streak_day_reached', params: { streak_length: 3 } },
  nux_step_view: { name: 'nux_step_view', params: { step: 'welcome' } },
  nux_step_complete: {
    name: 'nux_step_complete',
    params: { step: 'welcome', time_on_step_ms: 1234 },
  },
  nux_step_skipped: { name: 'nux_step_skipped', params: { step: 'reminder' } },
  screen_view: { name: 'screen_view', params: { screen: 'practice' } },
  screen_exit: {
    name: 'screen_exit',
    params: { screen: 'practice', duration_ms: 5000 },
  },
  first_mode_session: { name: 'first_mode_session', params: { mode: 'listen' } },
  first_correct_letter: {
    name: 'first_correct_letter',
    params: { mode: 'practice' },
  },
  guided_phase_advance: {
    name: 'guided_phase_advance',
    params: { from_phase: 'teach', to_phase: 'practice' },
  },
  guided_phase_complete: {
    name: 'guided_phase_complete',
    params: { phase: 'complete' },
  },
  setting_changed: {
    name: 'setting_changed',
    params: { setting: 'wpm', value: 18 },
  },
  phase_modal_dismissed: {
    name: 'phase_modal_dismissed',
    params: { phase: 'teach' },
  },
  sound_check: { name: 'sound_check' },
}

describe('AnalyticsClient', () => {
  it('forwards every defined event through the typed client', () => {
    for (const sample of Object.values(SAMPLES)) {
      if ('params' in sample && sample.params !== undefined) {
        noopAnalyticsClient.logEvent(sample.name, sample.params)
      } else {
        noopAnalyticsClient.logEvent(sample.name)
      }
    }
    noopAnalyticsClient.setUserId('abc123')
    noopAnalyticsClient.setUserId(null)
    expect(Object.keys(SAMPLES)).toHaveLength(15)
  })
})
