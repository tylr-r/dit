// Behavioral reference: morseUtils.ts and practiceReviewQueue.ts in shipped Dit.
export const PRACTICE_POOL = 'TENRA'
const delay = 3
const maxQueue = 24

export function pickWeighted(pool, scores, previous, roll) {
  return pickWithWeights(pool,scores,previous,roll,()=>0)
}

// morseUtils.getRandomLatencyAwareLetter: modest bonus only after five samples.
export function pickLatencyAware(pool,scores,ttr,previous,roll) {
  return pickWithWeights(pool,scores,previous,roll,letter=>{
    const entry=ttr[letter]
    return entry?.samples>=5 ? Math.min(2,Math.max(0,Math.round((entry.averageMs-1000)/700))) : 0
  })
}
function pickWithWeights(pool, scores, previous, roll, extra) {
  if (!pool.length) return previous
  if (pool.length === 1) return pool[0]
  const max = Math.max(...[...pool].map(letter => scores[letter] ?? 0))
  const weights = [...pool].map(letter => 3 + Math.max(0, max - (scores[letter] ?? 0)) + extra(letter))
  let remaining = Math.max(0, Math.min(1, Number.isFinite(roll) ? roll : 0)) *
    weights.reduce((sum, n) => sum + n, 0)
  for (const [i, weight] of weights.entries()) {
    remaining -= weight
    if (remaining <= 0) return pool[i] === previous ? pool[(i + 1) % pool.length] : pool[i]
  }
  return pool[pool.length - 1]
}

export function enqueueReview(queue, letter) {
  if (queue.some(item => item.letter === letter)) {
    return queue.map(item => item.letter === letter
      ? { ...item, remaining: Math.min(delay, item.remaining) } : item)
  }
  return [...queue, { letter, remaining: delay }].slice(-maxQueue)
}

export function pullReview(queue) {
  const stepped = queue.map(item => ({ ...item, remaining: item.remaining - 1 }))
  const index = stepped.findIndex(item => item.remaining <= 0)
  return index < 0 ? { queue: stepped, letter: null }
    : { queue: stepped.filter((_, i) => i !== index), letter: stepped[index].letter }
}
