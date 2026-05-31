import { describe, expect, it, vi } from 'vitest'
import {
  createLooseAnalyticsLogger,
  withAnalyticsContext,
} from '../../src/analytics'

describe('analytics helpers', () => {
  it('adds app surface context without letting callers override it', () => {
    expect(withAnalyticsContext('ios', { mode: 'practice', app_surface: 'web' })).toEqual({
      mode: 'practice',
      app_surface: 'ios',
    })
  })

  it('normalizes internal mode signals into bounded milestone events', () => {
    const emit = vi.fn()
    const seen = new Set<string>()
    const fireOnce = (key: string, fire: () => void) => {
      if (seen.has(key)) return
      seen.add(key)
      fire()
    }
    const logEvent = createLooseAnalyticsLogger(emit, fireOnce)

    logEvent('mode_correct_answer', { mode: 'practice' })
    logEvent('mode_correct_answer', { mode: 'practice' })
    logEvent('mode_start', { mode: 'practice' })
    logEvent('mode_start', { mode: 'practice' })

    expect(emit).not.toHaveBeenCalledWith(
      'mode_correct_answer',
      expect.anything(),
    )
    expect(emit).toHaveBeenCalledWith('first_correct_letter', {
      mode: 'practice',
    })
    expect(emit).toHaveBeenCalledWith('mode_start', { mode: 'practice' })
    expect(emit).toHaveBeenCalledWith('first_mode_session', {
      mode: 'practice',
    })
    expect(
      emit.mock.calls.filter(([event]) => event === 'first_correct_letter'),
    ).toHaveLength(1)
    expect(
      emit.mock.calls.filter(([event]) => event === 'first_mode_session'),
    ).toHaveLength(1)
  })
})
