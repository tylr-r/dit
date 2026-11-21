import { pickLatencyAware } from '../modules/web/progression.mjs'
import {
  enqueueListenOverlearnLetters, getListenOverlearnRepeats, pullNextListenOverlearnLetter,
  LISTEN_MAX_CONSECUTIVE_SAME, LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
} from '../modules/web/recognition.generated.mjs'

/** Shipped standalone Characters practice. Guided Listen has its own pack coverage rules. */
export function createAppleListenPractice(current) {
  let queue = []
  let last = null
  let count = 0
  function enqueue(letter, repeats) {
    queue = enqueueListenOverlearnLetters(queue,letter,repeats,LISTEN_OVERLEARN_MAX_QUEUE_SIZE)
  }
  return {
    miss(letter, averageMs) { enqueue(letter,getListenOverlearnRepeats(averageMs)) },
    reset() { queue = []; last = null; count = 0 },
    pick(previous) {
      const { studyPool, scores, listenTtr } = current()
      const { reviewLetter, nextQueue } = pullNextListenOverlearnLetter(queue,studyPool,previous)
      queue = nextQueue
      const choose = (pool,avoid) => pickLatencyAware(pool,scores,listenTtr,avoid,Math.random())
      let next = reviewLetter ?? choose(studyPool,previous)
      if (next === previous && last === previous && count >= LISTEN_MAX_CONSECUTIVE_SAME && studyPool.length > 1) {
        if (reviewLetter === previous) enqueue(previous,1)
        next = choose([...studyPool].filter(letter => letter !== previous))
      }
      count = next === last ? count + 1 : 1
      last = next
      return next
    },
  }
}
