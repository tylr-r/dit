import { describe, expect, it } from 'vitest'
import {
  hasMeaningfulProgress,
  hasMeaningfulRemoteProgress,
  isLearnerProfile,
  isNuxStep,
  parsePersistedNuxState,
} from '../../src/hooks/useOnboardingState'
import type { Progress } from '../../src/types'

describe('isNuxStep', () => {
  it('accepts every known NUX step value', () => {
    expect(isNuxStep('welcome')).toBe(true)
    expect(isNuxStep('profile')).toBe(true)
    expect(isNuxStep('sound_check')).toBe(true)
    expect(isNuxStep('button_tutorial')).toBe(true)
    expect(isNuxStep('known_tour')).toBe(true)
    expect(isNuxStep('beginner_stages')).toBe(true)
    expect(isNuxStep('beginner_intro')).toBe(true)
    expect(isNuxStep('reminder')).toBe(true)
  })

  it('rejects unknown or non-string values', () => {
    expect(isNuxStep('nope')).toBe(false)
    expect(isNuxStep(null)).toBe(false)
    expect(isNuxStep(42)).toBe(false)
    expect(isNuxStep({ step: 'welcome' })).toBe(false)
  })
})

describe('isLearnerProfile', () => {
  it('only accepts known and beginner', () => {
    expect(isLearnerProfile('known')).toBe(true)
    expect(isLearnerProfile('beginner')).toBe(true)
    expect(isLearnerProfile('advanced')).toBe(false)
    expect(isLearnerProfile(null)).toBe(false)
    expect(isLearnerProfile(undefined)).toBe(false)
  })
})

describe('parsePersistedNuxState', () => {
  it('returns null for empty, malformed, or unknown-step payloads', () => {
    expect(parsePersistedNuxState(null)).toBeNull()
    expect(parsePersistedNuxState('')).toBeNull()
    expect(parsePersistedNuxState('{not json')).toBeNull()
    expect(parsePersistedNuxState(JSON.stringify({ step: 'bogus' }))).toBeNull()
  })

  it('normalizes counts, coerces invalid learnerProfile to null, and defaults flags', () => {
    const raw = JSON.stringify({
      step: 'button_tutorial',
      learnerProfile: 'unrecognized',
      didCompleteSoundCheck: 'truthy',
      tutorialTapCount: 4.8,
      tutorialHoldCount: -3,
    })

    expect(parsePersistedNuxState(raw)).toEqual({
      step: 'button_tutorial',
      learnerProfile: null,
      didCompleteSoundCheck: false,
      tutorialTapCount: 4,
      tutorialHoldCount: 0,
    })
  })

  it('preserves a valid learner profile and boolean soundCheck flag', () => {
    const raw = JSON.stringify({
      step: 'welcome',
      learnerProfile: 'beginner',
      didCompleteSoundCheck: true,
      tutorialTapCount: 2,
      tutorialHoldCount: 1,
    })

    expect(parsePersistedNuxState(raw)).toEqual({
      step: 'welcome',
      learnerProfile: 'beginner',
      didCompleteSoundCheck: true,
      tutorialTapCount: 2,
      tutorialHoldCount: 1,
    })
  })
})

describe('hasMeaningfulProgress', () => {
  it('returns false for empty, defaults-only, or malformed progress', () => {
    expect(hasMeaningfulProgress(null)).toBe(false)
    expect(hasMeaningfulProgress('')).toBe(false)
    expect(hasMeaningfulProgress('not json')).toBe(false)

    // Defaults-only snapshot: no profile, no guided course, zeroed scores.
    const defaults = JSON.stringify({
      learnerProfile: undefined,
      guidedCourseActive: false,
      scores: { A: 0, B: 0, C: 0 },
    })
    expect(hasMeaningfulProgress(defaults)).toBe(false)
  })

  it('detects a set learnerProfile as real progress', () => {
    const raw = JSON.stringify({ learnerProfile: 'known', scores: { A: 0 } })
    expect(hasMeaningfulProgress(raw)).toBe(true)
  })

  it('detects guidedCourseActive as real progress', () => {
    const raw = JSON.stringify({ guidedCourseActive: true, scores: {} })
    expect(hasMeaningfulProgress(raw)).toBe(true)
  })

  it('detects any positive score as real progress', () => {
    const raw = JSON.stringify({ scores: { A: 0, B: 3, C: 0 } })
    expect(hasMeaningfulProgress(raw)).toBe(true)
  })
})

describe('hasMeaningfulRemoteProgress', () => {
  it('returns false for null', () => {
    expect(hasMeaningfulRemoteProgress(null)).toBe(false)
  })

  it('returns false for an empty progress object', () => {
    expect(hasMeaningfulRemoteProgress({})).toBe(false)
  })

  it('returns false for a defaults-only snapshot', () => {
    expect(
      hasMeaningfulRemoteProgress({
        guidedCourseActive: false,
        scores: { A: 0, B: 0, C: 0 } as Progress['scores'],
      }),
    ).toBe(false)
  })

  it('detects a set learnerProfile as real progress', () => {
    expect(hasMeaningfulRemoteProgress({ learnerProfile: 'beginner' })).toBe(true)
  })

  it('detects guidedCourseActive as real progress', () => {
    expect(hasMeaningfulRemoteProgress({ guidedCourseActive: true })).toBe(true)
  })

  it('detects any positive score as real progress', () => {
    expect(
      hasMeaningfulRemoteProgress({
        scores: { A: 0, B: 3 } as Progress['scores'],
      }),
    ).toBe(true)
  })
})
