import { describe, expect, it } from 'vitest'
import {
  BEGINNER_COURSE_PACKS,
  createGuidedLessonProgress,
  getBeginnerCoursePack,
  getBeginnerUnlockedLetters,
  isGuidedListenComplete,
  isGuidedPracticeComplete,
  isGuidedTeachComplete,
  recordGuidedListenResult,
  recordGuidedPracticeResult,
  recordGuidedTeachSuccess,
} from '../../src'

describe('beginner course helpers', () => {
  it('returns the expected beginner pack ordering', () => {
    expect(BEGINNER_COURSE_PACKS[0]).toEqual(['E', 'T'])
    expect(BEGINNER_COURSE_PACKS.at(-1)).toEqual(['Q', 'Y', 'Z'])
    expect(getBeginnerCoursePack(2)).toEqual(['I', 'M'])
  })

  it('collects unlocked letters through the current pack', () => {
    expect(getBeginnerUnlockedLetters(1)).toEqual(['E', 'T', 'A', 'N'])
  })

  it('tracks teach completion per letter', () => {
    let progress = createGuidedLessonProgress()
    progress = recordGuidedTeachSuccess(progress, 'E')
    progress = recordGuidedTeachSuccess(progress, 'T')
    expect(isGuidedTeachComplete(progress, ['E', 'T'])).toBe(false)
    progress = recordGuidedTeachSuccess(progress, 'E')
    progress = recordGuidedTeachSuccess(progress, 'T')
    expect(isGuidedTeachComplete(progress, ['E', 'T'])).toBe(true)
  })

  it('requires both overall and per-letter mastery for guided practice', () => {
    let progress = createGuidedLessonProgress()
    for (let index = 0; index < 8; index += 1) {
      progress = recordGuidedPracticeResult(progress, 'E', true)
    }
    for (let index = 0; index < 2; index += 1) {
      progress = recordGuidedPracticeResult(progress, 'T', false)
    }
    expect(isGuidedPracticeComplete(progress, ['E', 'T'])).toBe(false)

    progress = createGuidedLessonProgress()
    const answers: Array<['E' | 'T', boolean]> = [
      ['E', true],
      ['T', true],
      ['E', true],
      ['T', true],
      ['E', true],
      ['T', true],
      ['E', true],
      ['T', true],
      ['E', false],
      ['T', false],
    ]
    answers.forEach(([letter, isCorrect]) => {
      progress = recordGuidedPracticeResult(progress, letter, isCorrect)
    })
    expect(isGuidedPracticeComplete(progress, ['E', 'T'])).toBe(true)
  })

  it('requires each current-pack letter to be heard correctly in listen', () => {
    let progress = createGuidedLessonProgress()
    ;['E', 'T', 'E', 'T'].forEach((letter) => {
      progress = recordGuidedListenResult(progress, letter as 'E' | 'T', true)
    })
    progress = recordGuidedListenResult(progress, 'E', false)
    progress = recordGuidedListenResult(progress, 'T', false)
    expect(isGuidedListenComplete(progress, ['E', 'T'])).toBe(true)
  })
})
