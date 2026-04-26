import { describe, expect, it } from 'vitest'
import type { Letter } from '../../src/data/morse'
import type { ListenTtrRecord } from '../../src/types'
import {
  applyListenTtrSample,
  createInitialPracticeConfig,
  enqueueListenOverlearnLetters,
  getDeleteAccountErrorMessage,
  getEmailSignInErrorMessage,
  getEmailSignUpErrorMessage,
  getGuidedPracticePool,
  getLevelForLetters,
  getListenOverlearnRepeats,
  getNextOrderedLetter,
  getSignInErrorMessage,
  isErrorWithCode,
  pullNextListenOverlearnLetter,
  LEVELS,
  LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
  LISTEN_OVERLEARN_STRONG_THRESHOLD_MS,
  LISTEN_OVERLEARN_THRESHOLD_MS,
  LISTEN_TTR_MAX_MS,
} from '../../src/utils/appState'

describe('appState utils', () => {
  it('wraps ordered letter selection at the end of the list', () => {
    const letters: Letter[] = ['T', 'E', 'N']
    expect(getNextOrderedLetter(letters, 'T')).toBe('E')
    expect(getNextOrderedLetter(letters, 'N')).toBe('T')
    expect(getNextOrderedLetter(letters, 'Z' as Letter)).toBe('T')
    expect(getNextOrderedLetter([], 'T')).toBe('T')
  })

  it('derives the level for a letter set from the highest per-letter level', () => {
    expect(getLevelForLetters([])).toBe(LEVELS[0])
    const [teachFirst] = getGuidedPracticePool(0).currentPack
    expect(getLevelForLetters([teachFirst])).toBeGreaterThanOrEqual(1)
  })

  it('seeds an EMA when a letter has no prior TTR samples', () => {
    const record: ListenTtrRecord = {}
    const next = applyListenTtrSample(record, 'E', 500)
    expect(next.E).toEqual({ averageMs: 500, samples: 1 })
  })

  it('blends new TTR samples using the EMA alpha and clamps to bounds', () => {
    const record: ListenTtrRecord = {
      E: { averageMs: 1000, samples: 10 },
    }
    const next = applyListenTtrSample(record, 'E', LISTEN_TTR_MAX_MS * 2)
    expect(next.E.samples).toBe(11)
    expect(next.E.averageMs).toBeGreaterThan(1000)
    expect(next.E.averageMs).toBeLessThanOrEqual(LISTEN_TTR_MAX_MS)
  })

  it('ignores invalid TTR samples', () => {
    const record: ListenTtrRecord = {
      E: { averageMs: 500, samples: 2 },
    }
    expect(applyListenTtrSample(record, 'E', Number.NaN)).toBe(record)
    expect(applyListenTtrSample(record, 'E', 500, 0)).toBe(record)
  })

  it('stages overlearn repeats by average latency', () => {
    expect(getListenOverlearnRepeats(LISTEN_OVERLEARN_THRESHOLD_MS - 1)).toBe(0)
    expect(getListenOverlearnRepeats(LISTEN_OVERLEARN_THRESHOLD_MS)).toBe(1)
    expect(getListenOverlearnRepeats(LISTEN_OVERLEARN_STRONG_THRESHOLD_MS)).toBe(2)
  })

  it('bounds the overlearn queue at the configured max size', () => {
    const queue = enqueueListenOverlearnLetters(
      [],
      'E',
      LISTEN_OVERLEARN_MAX_QUEUE_SIZE + 5,
      LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
    )
    expect(queue.length).toBe(LISTEN_OVERLEARN_MAX_QUEUE_SIZE)
  })

  it('pulls a different letter than the previous one when possible', () => {
    const queue: Letter[] = ['A', 'B', 'A']
    const { reviewLetter, nextQueue } = pullNextListenOverlearnLetter(
      queue,
      ['A', 'B'],
      'A',
    )
    expect(reviewLetter).toBe('B')
    expect(nextQueue).toEqual(['A', 'A'])
  })

  it('returns null when the overlearn queue has no allowed letters', () => {
    const { reviewLetter, nextQueue } = pullNextListenOverlearnLetter(
      ['Z' as Letter],
      ['A', 'B'],
      'A',
    )
    expect(reviewLetter).toBeNull()
    expect(nextQueue).toEqual([])
  })

  it('produces an initial practice config with a letter and word', () => {
    const config = createInitialPracticeConfig()
    expect(typeof config.letter).toBe('string')
    expect(typeof config.practiceWord).toBe('string')
  })

  it('detects error codes via isErrorWithCode', () => {
    expect(isErrorWithCode({ code: 'ERR_X' }, 'ERR_X')).toBe(true)
    expect(isErrorWithCode({ code: 'ERR_Y' }, 'ERR_X')).toBe(false)
    expect(isErrorWithCode(null, 'ERR_X')).toBe(false)
  })

  it('routes delete-account errors to user-facing copy by code', () => {
    expect(
      getDeleteAccountErrorMessage({ code: 'ERR_APPLE_ACCOUNT_DELETION_USER_MISMATCH' }),
    ).toMatch(/Apple account/)
    expect(getDeleteAccountErrorMessage({ code: 'auth/requires-recent-login' })).toMatch(
      /sign in again/i,
    )
    expect(getDeleteAccountErrorMessage({ code: 'auth/network-request-failed' })).toMatch(
      /network/i,
    )
    expect(getDeleteAccountErrorMessage({})).toMatch(/could not delete/i)
  })

  it('routes sign-in errors to user-facing copy by code', () => {
    expect(
      getSignInErrorMessage({ code: 'auth/account-exists-with-different-credential' }),
    ).toMatch(/different sign-in method/)
    expect(getSignInErrorMessage({ code: 'auth/network-request-failed' })).toMatch(
      /network/i,
    )
    expect(getSignInErrorMessage({})).toMatch(/could not sign you in/i)
  })

  it('maps email sign-in error codes to user-facing copy', () => {
    expect(getEmailSignInErrorMessage({ code: 'auth/invalid-email' })).toMatch(
      /not valid/i,
    )
    expect(
      getEmailSignInErrorMessage({ code: 'auth/invalid-credential' }),
    ).toMatch(/email or password is incorrect/i)
    expect(getEmailSignInErrorMessage({ code: 'auth/wrong-password' })).toMatch(
      /email or password is incorrect/i,
    )
    expect(getEmailSignInErrorMessage({ code: 'auth/user-not-found' })).toMatch(
      /email or password is incorrect/i,
    )
    expect(getEmailSignInErrorMessage({ code: 'auth/user-disabled' })).toMatch(
      /disabled/i,
    )
    expect(
      getEmailSignInErrorMessage({ code: 'auth/too-many-requests' }),
    ).toMatch(/too many/i)
    expect(getEmailSignInErrorMessage({})).toMatch(/could not sign you in/i)
  })

  it('maps email sign-up error codes to user-facing copy', () => {
    expect(getEmailSignUpErrorMessage({ code: 'auth/invalid-email' })).toMatch(
      /not valid/i,
    )
    expect(
      getEmailSignUpErrorMessage({ code: 'auth/email-already-in-use' }),
    ).toMatch(/already exists/i)
    expect(getEmailSignUpErrorMessage({ code: 'auth/weak-password' })).toMatch(
      /at least 6/i,
    )
    expect(
      getEmailSignUpErrorMessage({ code: 'auth/network-request-failed' }),
    ).toMatch(/network/i)
    expect(getEmailSignUpErrorMessage({})).toMatch(/could not create/i)
  })
})
