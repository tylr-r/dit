import { type Letter } from '@dit/core'
import { describe, expect, it } from 'vitest'
import {
  enqueueReviewLetter,
  filterReviewQueue,
  pullDueReviewLetter,
  type PracticeReviewItem,
} from '../../src/utils/practiceReviewQueue'

describe('practiceReviewQueue utils', () => {
  it('queues missed letters with bounded size', () => {
    const queue = [] as PracticeReviewItem[]
    const first = enqueueReviewLetter(queue, 'A', 3, 2)
    const second = enqueueReviewLetter(first, 'B', 3, 2)
    const third = enqueueReviewLetter(second, 'C', 3, 2)
    expect(third).toEqual([
      { letter: 'B', remainingSteps: 3 },
      { letter: 'C', remainingSteps: 3 },
    ])
  })

  it('refreshes existing letter urgency without duplicates', () => {
    const queue: PracticeReviewItem[] = [
      { letter: 'A', remainingSteps: 4 },
      { letter: 'B', remainingSteps: 2 },
    ]
    const next = enqueueReviewLetter(queue, 'A', 3, 10)
    expect(next).toEqual([
      { letter: 'A', remainingSteps: 3 },
      { letter: 'B', remainingSteps: 2 },
    ])
  })

  it('returns due review letters after delay steps', () => {
    let queue: PracticeReviewItem[] = [
      { letter: 'A', remainingSteps: 2 },
      { letter: 'B', remainingSteps: 4 },
    ]

    const firstPull = pullDueReviewLetter(queue)
    expect(firstPull.reviewLetter).toBeNull()
    queue = firstPull.nextQueue

    const secondPull = pullDueReviewLetter(queue)
    expect(secondPull.reviewLetter).toBe('A')
    queue = secondPull.nextQueue
    expect(queue).toEqual([{ letter: 'B', remainingSteps: 2 }])
  })

  it('filters queue entries to allowed letters', () => {
    const queue: PracticeReviewItem[] = [
      { letter: 'A', remainingSteps: 2 },
      { letter: 'B', remainingSteps: 1 },
      { letter: 'Z', remainingSteps: 3 },
    ]
    const allowed = ['A', 'Z'] as Letter[]
    expect(filterReviewQueue(queue, allowed)).toEqual([
      { letter: 'A', remainingSteps: 2 },
      { letter: 'Z', remainingSteps: 3 },
    ])
  })
})
