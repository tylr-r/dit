import { MORSE_DATA } from './reference-morse.generated.mjs'
import { classifyLetter, getRecognitionFillRatio, getAverageRecognitionMs } from './reference-retention.generated.mjs'

export { recordLetterAttempt } from './reference-retention.generated.mjs'

const ordered = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const referencePattern = letter =>
  typeof letter==='string' && Object.hasOwn(MORSE_DATA,letter) ? MORSE_DATA[letter].code : null

/** Derive source mastery from actual independent recent windows, never bounded global history. */
export function buildReference({scores,letterAccuracy,history}) {
  const result={mastered:[],learning:[],noEvidence:[],recentSend:0,recentListen:0}
  const buckets={mastered:'mastered',learning:'learning','not-yet':'noEvidence'}
  for (const letter of ordered) result[buckets[classifyLetter({scores,letterAccuracy},letter)]].push(letter)
  for (const attempt of history) result[attempt.mode==='listen'?'recentListen':'recentSend']++
  return result
}

/** Source recognition summary excludes pre-mastery samples. Bars never imply an unmeasured zero. */
export function buildRecognition({scores,letterAccuracy,listenTtr}) {
  return {
    average: getAverageRecognitionMs({scores,letterAccuracy},listenTtr),
    bars: [...ordered].flatMap(letter => {
      const entry=listenTtr?.[letter]
      if (!entry) return []
      const floor = classifyLetter({scores, letterAccuracy}, letter) === 'mastered' ? 0.05 : 0
      const fill = Math.round(Math.max(floor, getRecognitionFillRatio(entry.averageMs)) * 100)
      return [{ letter, ...entry, fill }]
    }),
  }
}
