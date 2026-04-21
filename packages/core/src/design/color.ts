import type { HslTriplet } from './tokens'

/** Utility helpers for constructing token-based color strings. */
export const hslaFromHsl = ({ h, s, l }: HslTriplet, alpha: number) =>
  `hsla(${h}, ${s}%, ${l}%, ${alpha})`

const hslToRgb = ({ h, s, l }: HslTriplet) => {
  const hue = ((h % 360) + 360) % 360
  const sat = Math.min(Math.max(s, 0), 100) / 100
  const light = Math.min(Math.max(l, 0), 100) / 100

  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = light - chroma / 2

  let rPrime = 0
  let gPrime = 0
  let bPrime = 0

  if (hue < 60) {
    rPrime = chroma
    gPrime = x
  } else if (hue < 120) {
    rPrime = x
    gPrime = chroma
  } else if (hue < 180) {
    gPrime = chroma
    bPrime = x
  } else if (hue < 240) {
    gPrime = x
    bPrime = chroma
  } else if (hue < 300) {
    rPrime = x
    bPrime = chroma
  } else {
    rPrime = chroma
    bPrime = x
  }

  const r = Math.round((rPrime + m) * 255)
  const g = Math.round((gPrime + m) * 255)
  const b = Math.round((bPrime + m) * 255)

  return { r, g, b }
}

/** For APIs that only accept RGBA channel strings. */
export const rgbaFromHsl = (hsl: HslTriplet, alpha: number) => {
  const { r, g, b } = hslToRgb(hsl)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Converts hsl()/hsla() strings to rgba() for APIs with limited color parsing. */
export const normalizeColorForNative = (color: string) => {
  const hslMatch = color.match(
    /^hsla?\(\s*([-\d.]+)\s*,\s*([-\d.]+)%\s*,\s*([-\d.]+)%\s*(?:,\s*([-\d.]+)\s*)?\)$/i,
  )
  if (!hslMatch) {
    return color
  }

  const h = Number(hslMatch[1])
  const s = Number(hslMatch[2])
  const l = Number(hslMatch[3])
  const alpha = hslMatch[4] == null ? 1 : Number(hslMatch[4])
  if (
    Number.isNaN(h) ||
    Number.isNaN(s) ||
    Number.isNaN(l) ||
    Number.isNaN(alpha)
  ) {
    return color
  }

  return rgbaFromHsl({ h, s, l }, alpha)
}
