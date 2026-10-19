import { MORSE_DATA, type Letter } from '../data/morse'
import { CONVERSATION_PROSIGNS } from './conversation'
import { normalizeCustomText } from './customListenText'
import { getReceivedTextAtElapsedMs } from './listenWave'
import { decodeMorseCode } from './morseUtils'

const prosignCodes = new Map<string, string>(CONVERSATION_PROSIGNS.map(([name]) => [
  name,
  [...name].map((letter) => MORSE_DATA[letter as Letter].code).join(''),
]))
const prosignNames = new Map([...prosignCodes].map(([name, code]) => [code, name]))

// Each token labels one transmitted character or one word gap. Match whole
// words so a prosign inside a callsign or ordinary word stays letter-spaced.
const tokenizeConversationText = (text: string): string[] =>
  text.split(/( )/).flatMap((word) =>
    word === ' ' || prosignCodes.has(word) ? [word] : [...word],
  )

/** Encodes Conversation's standalone prosigns as continuous Morse characters. */
export const textToConversationMorseCode = (input: string) => {
  const result = normalizeCustomText(input)
  const code = tokenizeConversationText(result.normalized).map((token) =>
    token === ' ' ? '/' : prosignCodes.get(token) ?? MORSE_DATA[token as Letter].code,
  ).join(' ')
  return { ...result, code }
}

/** Decodes letters, digits, and the joined signals taught by Conversation. */
export const decodeConversationMorseCode = (code: string): string | null =>
  prosignNames.get(code) ?? decodeMorseCode(code)

/** Reveals a prosign's complete label only after its continuous tones finish. */
export const getReceivedConversationTextAtElapsedMs = (
  text: string,
  code: string,
  unitMs: number,
  elapsedMs: number,
  interCharacterGapMs: number = unitMs * 3,
  interWordGapMs: number = (interCharacterGapMs * 7) / 3,
) => getReceivedTextAtElapsedMs(
  tokenizeConversationText(text), code, unitMs, elapsedMs, interCharacterGapMs, interWordGapMs,
)
