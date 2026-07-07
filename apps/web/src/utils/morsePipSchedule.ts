import { getFarnsworthUnitMs, getListenUnitMs } from '@dit/core'

export type MorsePip = {
  /** '.' or '-' */
  symbol: '.' | '-'
  /** Index of the character token this pip belongs to. */
  tokenIndex: number
  /** Milliseconds from playback start when this pip's tone begins. */
  startMs: number
  /** Milliseconds this pip's tone lasts. */
  durationMs: number
}

export type MorsePipSchedule = {
  pips: MorsePip[]
  /** Total playback duration in milliseconds. */
  totalMs: number
}

/**
 * Builds a visual timeline for a Morse code string that mirrors the audio
 * scheduling in utils/tone.ts playMorseTone: dits are 1 character unit, dahs
 * are 3, intra-character gaps are 1 character unit, and inter-character gaps
 * are 3 Farnsworth units. Word gaps ('/') advance 7 Farnsworth units.
 *
 * Keeping the math identical to the audio path is the whole point — the pips
 * light exactly when their tone sounds.
 */
export const buildMorsePipSchedule = (
  code: string,
  characterWpm: number,
  effectiveWpm: number,
  minUnitMs = 40,
): MorsePipSchedule => {
  const characterUnitMs = getListenUnitMs(characterWpm, minUnitMs)
  const resolvedEffectiveWpm = Math.min(characterWpm, effectiveWpm)
  const farnsworthUnitMs = getFarnsworthUnitMs(
    characterWpm,
    resolvedEffectiveWpm,
    minUnitMs,
  )
  const interCharacterGapMs = farnsworthUnitMs * 3
  const interWordGapMs = farnsworthUnitMs * 7

  const tokens = code
    .split(' ')
    .filter((token) => token === '/' || /[.-]/.test(token))

  const pips: MorsePip[] = []
  let cursor = 0
  let characterIndex = 0
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (token === '/') {
      cursor += interWordGapMs
      continue
    }
    const symbols = token
      .split('')
      .filter((s): s is '.' | '-' => s === '.' || s === '-')
    for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
      const symbol = symbols[symbolIndex]
      const durationMs =
        symbol === '.' ? characterUnitMs : characterUnitMs * 3
      pips.push({ symbol, tokenIndex: characterIndex, startMs: cursor, durationMs })
      cursor += durationMs
      if (symbolIndex < symbols.length - 1) {
        cursor += characterUnitMs
      }
    }
    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1] !== '/') {
      cursor += interCharacterGapMs
    }
    characterIndex += 1
  }

  return { pips, totalMs: cursor }
}
