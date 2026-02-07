import type { Letter } from '@dit/core'

export type PracticeReviewItem = {
  letter: Letter
  remainingSteps: number
}

type PullResult = {
  nextQueue: PracticeReviewItem[]
  reviewLetter: Letter | null
}

export const enqueueReviewLetter = (
  queue: PracticeReviewItem[],
  letter: Letter,
  delaySteps: number,
  maxSize: number,
) => {
  const normalizedDelay = Math.max(1, Math.round(delaySteps))
  const normalizedMaxSize = Math.max(1, Math.round(maxSize))
  const existingIndex = queue.findIndex((item) => item.letter === letter)
  if (existingIndex >= 0) {
    return queue.map((item, index) =>
      index === existingIndex
        ? {
            ...item,
            remainingSteps: Math.min(item.remainingSteps, normalizedDelay),
          }
        : item,
    )
  }
  const nextQueue = [
    ...queue,
    {
      letter,
      remainingSteps: normalizedDelay,
    },
  ]
  if (nextQueue.length <= normalizedMaxSize) {
    return nextQueue
  }
  return nextQueue.slice(nextQueue.length - normalizedMaxSize)
}

export const pullDueReviewLetter = (queue: PracticeReviewItem[]): PullResult => {
  if (queue.length === 0) {
    return {
      nextQueue: queue,
      reviewLetter: null,
    }
  }
  const decremented = queue.map((item) => ({
    ...item,
    remainingSteps: item.remainingSteps - 1,
  }))
  const dueIndex = decremented.findIndex((item) => item.remainingSteps <= 0)
  if (dueIndex < 0) {
    return {
      nextQueue: decremented,
      reviewLetter: null,
    }
  }
  return {
    nextQueue: decremented.filter((_, index) => index !== dueIndex),
    reviewLetter: decremented[dueIndex].letter,
  }
}

export const filterReviewQueue = (
  queue: PracticeReviewItem[],
  allowedLetters: Letter[],
) => {
  const allowed = new Set(allowedLetters)
  return queue.filter((item) => allowed.has(item.letter))
}
