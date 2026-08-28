const PREFIXES = ['K', 'N', 'W'] as const
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export interface GeneratePracticeCallsignOptions {
  previousCallsign?: string
  random?: () => number
}

export const generatePracticeCallsign = ({
  previousCallsign,
  random = Math.random,
}: GeneratePracticeCallsignOptions = {}): string => {
  const prefix = PREFIXES[Math.floor(random() * PREFIXES.length)]
  const digit = Math.floor(random() * 10)
  const suffix = Array.from(
    { length: 3 },
    () => LETTERS[Math.floor(random() * LETTERS.length)],
  ).join('')

  const callsign = `${prefix}${digit}${suffix}`
  if (callsign !== previousCallsign) {
    return callsign
  }

  const finalLetterIndex = LETTERS.indexOf(callsign.at(-1) ?? '')
  const nextLetter = LETTERS[(finalLetterIndex + 1) % LETTERS.length]
  return `${callsign.slice(0, -1)}${nextLetter}`
}
