export type ListenWavePlayback = {
  sequence: number
  code: string
  unitMs: number
}

const DOT_ENERGY = 0.72
const DASH_ENERGY = 1

export const getListenUnitMs = (wpm: number, minUnitMs: number) =>
  Math.max(Math.round(1200 / wpm), minUnitMs)

const isMorseSymbol = (value: string) => value === '.' || value === '-'

export const getListenToneLevelAtElapsedMs = (
  code: string,
  unitMs: number,
  elapsedMs: number,
) => {
  if (unitMs <= 0 || elapsedMs < 0) {
    return 0
  }

  let cursorMs = 0
  for (const symbol of code) {
    if (!isMorseSymbol(symbol)) {
      continue
    }
    const toneMs = symbol === '.' ? unitMs : unitMs * 3
    if (elapsedMs < cursorMs + toneMs) {
      return symbol === '.' ? DOT_ENERGY : DASH_ENERGY
    }
    cursorMs += toneMs
    if (elapsedMs < cursorMs + unitMs) {
      return 0
    }
    cursorMs += unitMs
  }
  return 0
}
