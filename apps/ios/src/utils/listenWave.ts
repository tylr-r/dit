export type ListenWavePlayback = {
  sequence: number
  code: string
  unitMs: number
  interCharacterGapMs: number
}

const DOT_ENERGY = 0.72
const DASH_ENERGY = 1

export const getListenUnitMs = (wpm: number, minUnitMs: number) =>
  Math.max(Math.round(1200 / wpm), minUnitMs)

export const getListenTiming = (
  characterWpm: number,
  effectiveWpm: number,
  minUnitMs: number,
) => {
  const unitMs = getListenUnitMs(characterWpm, minUnitMs)
  const effectiveUnitMs = getListenUnitMs(effectiveWpm, minUnitMs)
  return {
    unitMs,
    interCharacterGapMs: Math.max(unitMs * 3, effectiveUnitMs * 3),
  }
}

const isMorseSymbol = (value: string) => value === '.' || value === '-'

export const getListenToneLevelAtElapsedMs = (
  code: string,
  unitMs: number,
  elapsedMs: number,
  interCharacterGapMs: number = unitMs * 3,
) => {
  if (unitMs <= 0 || elapsedMs < 0) {
    return 0
  }

  const symbols = code.split('').filter(isMorseSymbol)
  if (symbols.length === 0) {
    return 0
  }

  let cursorMs = 0
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
    } else if (elapsedMs < cursorMs + interCharacterGapMs) {
      return 0
    }
  }
  return 0
}
