import { MORSE_DATA, type Letter } from '../data/morse'

export type NormalizeOptions = {
  /** Hard cap on character count after normalization. */
  maxChars?: number
}

export type NormalizeResult = {
  normalized: string
  ignored: number
  truncated: boolean
}

const SUPPORTED = /^[A-Z0-9]$/

/**
 * Sanitize a user-pasted passage to the alphabet Dit can play.
 * Uppercases letters, collapses whitespace runs to single spaces, strips
 * unsupported chars, and reports the count of dropped characters.
 */
export const normalizeCustomText = (
  input: string,
  options: NormalizeOptions = {},
): NormalizeResult => {
  const maxChars = options.maxChars ?? 2000
  let ignored = 0
  let out = ''
  let lastWasSpace = true // emit no leading whitespace
  for (const raw of input) {
    const upper = raw.toUpperCase()
    if (SUPPORTED.test(upper)) {
      out += upper
      lastWasSpace = false
      continue
    }
    if (raw === ' ' || raw === '\n' || raw === '\t' || raw === '\r') {
      if (!lastWasSpace) {
        out += ' '
        lastWasSpace = true
      }
      continue
    }
    ignored += 1
  }
  let truncated = false
  if (out.length > maxChars) {
    out = out.slice(0, maxChars).trimEnd()
    truncated = true
  } else {
    out = out.trimEnd()
  }
  return { normalized: out, ignored, truncated }
}

export type TextToMorseResult = {
  /** Morse code string in the format `playMorseTone` parses. */
  code: string
  /** The normalized source text the code represents. */
  normalized: string
  /** Count of unsupported characters dropped during normalization. */
  ignored: number
  /** True when the source text was longer than `maxChars` and was trimmed. */
  truncated: boolean
}

/**
 * Convert arbitrary user-pasted text into a Morse code string that
 * `playMorseTone` can play. Words are separated by ` / `, characters within a
 * word by single spaces, symbols within a character are concatenated.
 */
export const textToMorseCode = (
  input: string,
  options: NormalizeOptions = {},
): TextToMorseResult => {
  const { normalized, ignored, truncated } = normalizeCustomText(input, options)
  if (normalized.length === 0) {
    return { code: '', normalized, ignored, truncated }
  }
  const words = normalized.split(' ')
  const code = words
    .map((word) =>
      word
        .split('')
        .map((char) => MORSE_DATA[char as Letter].code)
        .join(' '),
    )
    .join(' / ')
  return { code, normalized, ignored, truncated }
}
