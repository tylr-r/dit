import {
  getFarnsworthUnitMs,
  getListenUnitMs as getListenUnitMsFromWpm,
} from './listenSpeed'

export type ListenWavePlayback = {
  sequence: number
  code: string
  unitMs: number
  interCharacterGapMs: number
}

const DOT_ENERGY = 0.72
const DASH_ENERGY = 1

export const getListenUnitMs = (wpm: number, minUnitMs: number) =>
  getListenUnitMsFromWpm(wpm, minUnitMs)

export const getListenTiming = (
  characterWpm: number,
  effectiveWpm: number,
  minUnitMs: number,
) => {
  const unitMs = getListenUnitMs(characterWpm, minUnitMs)
  const farnsworthUnitMs = getFarnsworthUnitMs(
    characterWpm,
    effectiveWpm,
    minUnitMs,
  )
  return {
    unitMs,
    interCharacterGapMs: farnsworthUnitMs * 3,
  }
}

const isMorseSymbol = (value: string) => value === '.' || value === '-'

const tokenize = (code: string) =>
  code
    .split(' ')
    .filter((token) => token === '/' || /^[.\-]+$/.test(token))

export const getListenPlaybackDurationMs = (
  code: string,
  unitMs: number,
  interCharacterGapMs: number = unitMs * 3,
  interWordGapMs: number = (interCharacterGapMs * 7) / 3,
) => {
  if (unitMs <= 0) {
    return 0
  }

  const tokens = tokenize(code)
  if (tokens.length === 0) {
    return 0
  }

  let elapsedMs = 0
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (token === '/') {
      elapsedMs += interWordGapMs
      continue
    }
    const symbols = token.split('').filter(isMorseSymbol)
    for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
      elapsedMs += symbols[symbolIndex] === '.' ? unitMs : unitMs * 3
      if (symbolIndex < symbols.length - 1) {
        elapsedMs += unitMs
      }
    }
    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1] !== '/') {
      elapsedMs += interCharacterGapMs
    }
  }
  return elapsedMs + interCharacterGapMs
}

/** Returns the portion of normalized text whose Morse tones have completed. */
export const getReceivedTextAtElapsedMs = (
  text: string,
  code: string,
  unitMs: number,
  elapsedMs: number,
  interCharacterGapMs: number = unitMs * 3,
  interWordGapMs: number = (interCharacterGapMs * 7) / 3,
) => {
  if (unitMs <= 0 || elapsedMs < 0 || text.length === 0) {
    return ''
  }

  const tokens = tokenize(code)
  let cursorMs = 0
  let textIndex = 0
  let received = ''

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (token === '/') {
      cursorMs += interWordGapMs
      if (elapsedMs < cursorMs) {
        return received
      }
      if (text[textIndex] === ' ') {
        received += ' '
        textIndex += 1
      }
      continue
    }

    const symbols = token.split('').filter(isMorseSymbol)
    for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
      cursorMs += symbols[symbolIndex] === '.' ? unitMs : unitMs * 3
      if (symbolIndex < symbols.length - 1) {
        cursorMs += unitMs
      }
    }
    if (elapsedMs < cursorMs) {
      return received
    }

    if (textIndex < text.length && text[textIndex] !== ' ') {
      received += text[textIndex]
      textIndex += 1
    }

    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1] !== '/') {
      cursorMs += interCharacterGapMs
    }
  }

  return received
}

export const getListenToneLevelAtElapsedMs = (
  code: string,
  unitMs: number,
  elapsedMs: number,
  interCharacterGapMs: number = unitMs * 3,
  interWordGapMs: number = (interCharacterGapMs * 7) / 3,
) => {
  if (unitMs <= 0 || elapsedMs < 0) {
    return 0
  }
  const tokens = tokenize(code)
  if (tokens.length === 0) {
    return 0
  }
  let cursorMs = 0
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (token === '/') {
      if (elapsedMs < cursorMs + interWordGapMs) {
        return 0
      }
      cursorMs += interWordGapMs
      continue
    }
    const symbols = token.split('').filter(isMorseSymbol)
    for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
      const symbol = symbols[symbolIndex]
      const toneMs = symbol === '.' ? unitMs : unitMs * 3
      if (elapsedMs < cursorMs + toneMs) {
        return symbol === '.' ? DOT_ENERGY : DASH_ENERGY
      }
      cursorMs += toneMs
      if (symbolIndex < symbols.length - 1) {
        if (elapsedMs < cursorMs + unitMs) {
          return 0
        }
        cursorMs += unitMs
      }
    }
    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1] !== '/') {
      if (elapsedMs < cursorMs + interCharacterGapMs) {
        return 0
      }
      cursorMs += interCharacterGapMs
    } else if (tokenIndex === tokens.length - 1) {
      if (elapsedMs < cursorMs + interCharacterGapMs) {
        return 0
      }
    }
  }
  return 0
}
