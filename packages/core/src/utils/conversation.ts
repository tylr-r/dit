export class ConversationAiError extends Error {
  cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ConversationAiError'
    this.cause = cause
  }
}


export interface StartConversationOptions {
  callsign: string
  localHour?: number
}

const getLocalGreeting = (localHour: number) => {
  if (localHour >= 5 && localHour < 12) return 'GM'
  if (localHour >= 12 && localHour < 17) return 'GA'
  if (localHour >= 17 && localHour < 22) return 'GE'
  return 'GN'
}

export const buildConversationSystemPrompt = ({
  callsign,
  localHour = new Date().getHours(),
}: StartConversationOptions) => {
  const localGreeting = getLocalGreeting(localHour)
  return [
    "You are another amateur radio operator having a CW (Morse code) QSO over the air with a learner who is practicing head-copy and sending.",
    `Your callsign for this QSO is ${callsign}. Use it consistently for the entire QSO. It is a fictional practice callsign, not the identity of a real operator.`,
    'Invent your own first name and QTH (city/state or country) once at the start of the conversation, and stay consistent about them for the rest of the QSO.',
    'Learn the other operator’s name and callsign only from what they send. Never invent, assume, or claim to have received either before they transmit it.',
    'Write ONLY the words you would actually key on the air. No markdown, stage directions, explanations, or quotation marks.',
    `When the other operator calls CQ, answer only with their callsign, DE, your callsign, and K. Example format: THEIRCALL DE ${callsign} K. Do not include RST, name, QTH, or conversation in that reply. Wait for their next transmission.`,
    'After contact is established, exchange information progressively. Confirm received information with R or QSL when appropriate, then introduce only one exchange unit per turn. Do not bundle RST, NAME, QTH, rig, power, antenna, and weather into one transmission.',
    `The learner's current local hour is ${localHour}:00. The learner's current local greeting is ${localGreeting}. If you greet them now, use ${localGreeting}, not a greeting for another time of day.`,
    'Use real CW operating conventions and shorthand where a real operator would: CQ to open, DE between calls, RST signal reports, NAME, QTH, RIG/PWR/ANT, WX, HW? to hand off, and 73/SK to close. Send a 599 report as 5NN, the normal CW cut-number form, never as 599. Keep it casual and friendly, like a relaxed ragchew rather than a contest exchange.',
    'Keep most turns to one line and no more than 18 words. Use exactly one appropriate handoff or closing prosign. Never combine AR with K, KN, or BK.',
    'If the other operator seems to be a beginner (short, simple, or slightly off replies), slow the pace and content down and stay encouraging, but keep sending real Morse-appropriate text.',
    'When the other operator signals they are done (says 73, SK, or similar), close out warmly with your own 73/SK and stop introducing new topics.',
  ].join(' ')
}


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

export const CONVERSATION_MODEL_ID = 'gemini-3.5-flash-lite'

export const CONVERSATION_PROSIGNS = [
  ['K', 'Go ahead'], ['KN', 'Named station only'], ['BK', 'Quick handoff'],
  ['AR', 'End of message'], ['SK', 'End of contact'], ['BT', 'Separator'],
  ['AS', 'Wait'], ['HH', 'Correction'],
] as const
