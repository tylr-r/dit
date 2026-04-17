import { describe, expect, it } from 'vitest'
import {
  MORSE_DATA,
  STREAK_DAILY_GOAL,
  computeHero,
  countsAnswer,
  dateKey,
  isMastered,
  recordCorrectAnswer,
  recordLetterAttempt,
  todayStreakContribution,
  updateBestWpm,
  type Letter,
  type Progress,
} from '../../src'

const emptyProgress = (): Progress => ({})
const at = (iso: string) => new Date(`${iso}T12:00:00`)

describe('retention helpers', () => {
  describe('countsAnswer', () => {
    it('counts correct practice and listen answers', () => {
      expect(countsAnswer('practice', true)).toBe(true)
      expect(countsAnswer('listen', true)).toBe(true)
    })

    it('does not count incorrect answers', () => {
      expect(countsAnswer('practice', false)).toBe(false)
      expect(countsAnswer('listen', false)).toBe(false)
    })
  })

  describe('dateKey', () => {
    it('formats YYYY-MM-DD in local time', () => {
      expect(dateKey(new Date(2026, 3, 17, 23, 59))).toBe('2026-04-17')
      expect(dateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
    })
  })

  describe('recordCorrectAnswer', () => {
    it('increments daily count and tracks mode', () => {
      const next = recordCorrectAnswer(emptyProgress(), {
        letter: 'A',
        mode: 'practice',
        at: at('2026-04-17'),
      })
      expect(next.dailyActivity?.['2026-04-17']).toEqual({
        correct: 1,
        modes: ['practice'],
      })
    })

    it('does not duplicate modes on the same day', () => {
      let p = recordCorrectAnswer(emptyProgress(), {
        letter: 'A',
        mode: 'practice',
        at: at('2026-04-17'),
      })
      p = recordCorrectAnswer(p, {
        letter: 'B',
        mode: 'practice',
        at: at('2026-04-17'),
      })
      expect(p.dailyActivity?.['2026-04-17'].modes).toEqual(['practice'])
    })

    it('starts a streak when hitting 15 correct in a day', () => {
      let p = emptyProgress()
      for (let i = 0; i < 14; i += 1) {
        p = recordCorrectAnswer(p, {
          letter: 'A',
          mode: 'practice',
          at: at('2026-04-17'),
        })
      }
      expect(p.streak?.current ?? 0).toBe(0)
      p = recordCorrectAnswer(p, {
        letter: 'A',
        mode: 'practice',
        at: at('2026-04-17'),
      })
      expect(p.streak).toEqual({
        current: 1,
        longest: 1,
        lastCountedDate: '2026-04-17',
      })
    })

    it('extends a streak on consecutive days', () => {
      let p: Progress = {
        streak: { current: 3, longest: 3, lastCountedDate: '2026-04-16' },
      }
      for (let i = 0; i < STREAK_DAILY_GOAL; i += 1) {
        p = recordCorrectAnswer(p, {
          letter: 'A',
          mode: 'practice',
          at: at('2026-04-17'),
        })
      }
      expect(p.streak).toEqual({
        current: 4,
        longest: 4,
        lastCountedDate: '2026-04-17',
      })
    })

    it('resets the streak after a missed day', () => {
      let p: Progress = {
        streak: { current: 5, longest: 5, lastCountedDate: '2026-04-15' },
      }
      for (let i = 0; i < STREAK_DAILY_GOAL; i += 1) {
        p = recordCorrectAnswer(p, {
          letter: 'A',
          mode: 'practice',
          at: at('2026-04-17'),
        })
      }
      expect(p.streak?.current).toBe(1)
      expect(p.streak?.longest).toBe(5)
    })

    it('does not re-increment the streak within the same day after hitting the goal', () => {
      let p = emptyProgress()
      for (let i = 0; i < STREAK_DAILY_GOAL + 5; i += 1) {
        p = recordCorrectAnswer(p, {
          letter: 'A',
          mode: 'practice',
          at: at('2026-04-17'),
        })
      }
      expect(p.streak?.current).toBe(1)
    })

    it('appends to the letter accuracy ring buffer', () => {
      let p = emptyProgress()
      for (let i = 0; i < 12; i += 1) {
        p = recordCorrectAnswer(p, {
          letter: 'A',
          mode: 'practice',
          at: at('2026-04-17'),
        })
      }
      expect(p.letterAccuracy?.A?.recent.length).toBe(10)
    })

    it('prunes dailyActivity older than 60 days', () => {
      const old: Progress = {
        dailyActivity: {
          '2026-01-01': { correct: 5, modes: ['practice'] },
          '2026-04-10': { correct: 5, modes: ['practice'] },
        },
      }
      const next = recordCorrectAnswer(old, {
        letter: 'A',
        mode: 'practice',
        at: at('2026-04-17'),
      })
      expect(next.dailyActivity?.['2026-01-01']).toBeUndefined()
      expect(next.dailyActivity?.['2026-04-10']).toBeDefined()
    })
  })

  describe('isMastered', () => {
    it('requires score >= 5 AND 8+ of last 10 correct', () => {
      const recent = Array.from({ length: 10 }, (_, i) => i < 8)
      const progress: Progress = {
        scores: { A: 5 } as Progress['scores'],
        letterAccuracy: { A: { recent } },
      }
      expect(isMastered(progress, 'A')).toBe(true)
    })

    it('fails when score is below threshold', () => {
      const progress: Progress = {
        scores: { A: 4 } as Progress['scores'],
        letterAccuracy: { A: { recent: Array(10).fill(true) } },
      }
      expect(isMastered(progress, 'A')).toBe(false)
    })

    it('fails when accuracy window is short', () => {
      const progress: Progress = {
        scores: { A: 10 } as Progress['scores'],
        letterAccuracy: { A: { recent: [true, true, true] } },
      }
      expect(isMastered(progress, 'A')).toBe(false)
    })

    it('fails when accuracy is below 80%', () => {
      const recent = [...Array(7).fill(true), ...Array(3).fill(false)]
      const progress: Progress = {
        scores: { A: 10 } as Progress['scores'],
        letterAccuracy: { A: { recent } },
      }
      expect(isMastered(progress, 'A')).toBe(false)
    })
  })

  describe('computeHero', () => {
    it('returns mastered count for beginner profile', () => {
      const hero = computeHero({ learnerProfile: 'beginner' })
      expect(hero).toEqual({
        kind: 'mastered',
        count: 0,
        total: Object.keys(MORSE_DATA).length,
      })
    })

    it('returns best WPM for known profile', () => {
      const hero = computeHero({ learnerProfile: 'known', bestWpm: 22 })
      expect(hero).toEqual({ kind: 'wpm', value: 22 })
    })

    it('defaults to mastered count when profile is unset', () => {
      const hero = computeHero({})
      expect(hero.kind).toBe('mastered')
    })
  })

  describe('todayStreakContribution', () => {
    it('returns today progress and at-risk state', () => {
      const progress: Progress = {
        dailyActivity: { '2026-04-17': { correct: 4, modes: ['practice'] } },
        streak: { current: 3, longest: 3, lastCountedDate: '2026-04-16' },
      }
      const result = todayStreakContribution(progress, at('2026-04-17'))
      expect(result).toEqual({ correct: 4, goal: STREAK_DAILY_GOAL, atRisk: true })
    })

    it('is not at risk if today is already counted', () => {
      const progress: Progress = {
        dailyActivity: { '2026-04-17': { correct: 20, modes: ['practice'] } },
        streak: { current: 4, longest: 4, lastCountedDate: '2026-04-17' },
      }
      const result = todayStreakContribution(progress, at('2026-04-17'))
      expect(result.atRisk).toBe(false)
    })
  })

  describe('updateBestWpm', () => {
    it('updates when new value exceeds stored best', () => {
      const next = updateBestWpm({ bestWpm: 15 }, 18.2)
      expect(next.bestWpm).toBe(18.2)
    })

    it('leaves progress untouched when value does not exceed', () => {
      const input: Progress = { bestWpm: 20 }
      const next = updateBestWpm(input, 15)
      expect(next).toBe(input)
    })
  })

  describe('recordLetterAttempt', () => {
    it('records incorrect attempts so mastery can regress', () => {
      let p: Progress = {}
      for (let i = 0; i < 10; i += 1) {
        p = recordLetterAttempt(p, 'A', true)
      }
      p = recordLetterAttempt(p, 'A', false)
      const recent = p.letterAccuracy?.A?.recent ?? []
      expect(recent.length).toBe(10)
      expect(recent[recent.length - 1]).toBe(false)
    })
  })

  it('letter type sanity — A exists in MORSE_DATA', () => {
    const letter: Letter = 'A'
    expect(MORSE_DATA[letter]).toBeDefined()
  })
})
