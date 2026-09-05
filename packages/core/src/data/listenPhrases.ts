import type { ListenPhrase } from '../utils/listenPhrases'
import { PRACTICE_WORDS } from './practiceWords'

/** Common single-token shorthand heard during amateur-radio CW contacts. */
export const LISTEN_PHRASES = [
  {
    id: 'cq',
    text: 'CQ',
    meaning: 'Calling any station',
    difficulty: 'short',
    parts: [{ code: 'CQ', meaning: 'calling any station' }],
  },
  {
    id: 'de',
    text: 'DE',
    meaning: 'From, or this is',
    difficulty: 'short',
    parts: [{ code: 'DE', meaning: 'from or this is' }],
  },
  {
    id: 'r',
    text: 'R',
    meaning: 'Received correctly',
    difficulty: 'short',
    parts: [{ code: 'R', meaning: 'received correctly' }],
  },
  {
    id: '73',
    text: '73',
    meaning: 'Best regards',
    difficulty: 'short',
    parts: [{ code: '73', meaning: 'best regards' }],
  },
  {
    id: 'fb',
    text: 'FB',
    meaning: 'Fine business; excellent',
    difficulty: 'short',
    parts: [{ code: 'FB', meaning: 'fine business or excellent' }],
  },
  {
    id: 'wx',
    text: 'WX',
    meaning: 'Weather',
    difficulty: 'short',
    parts: [{ code: 'WX', meaning: 'weather' }],
  },
  {
    id: 'pse',
    text: 'PSE',
    meaning: 'Please',
    difficulty: 'medium',
    parts: [{ code: 'PSE', meaning: 'please' }],
  },
  {
    id: 'tnx',
    text: 'TNX',
    meaning: 'Thanks',
    difficulty: 'medium',
    parts: [{ code: 'TNX', meaning: 'thanks' }],
  },
  {
    id: 'agn',
    text: 'AGN',
    meaning: 'Again',
    difficulty: 'medium',
    parts: [{ code: 'AGN', meaning: 'again' }],
  },
  {
    id: 'sri',
    text: 'SRI',
    meaning: 'Sorry',
    difficulty: 'medium',
    parts: [{ code: 'SRI', meaning: 'sorry' }],
  },
  {
    id: 'rig',
    text: 'RIG',
    meaning: 'Station equipment',
    difficulty: 'medium',
    parts: [{ code: 'RIG', meaning: 'station equipment' }],
  },
  {
    id: 'ant',
    text: 'ANT',
    meaning: 'Antenna',
    difficulty: 'medium',
    parts: [{ code: 'ANT', meaning: 'antenna' }],
  },
  {
    id: 'qrl',
    text: 'QRL',
    meaning: 'The frequency is in use',
    difficulty: 'medium',
    parts: [{ code: 'QRL', meaning: 'frequency is in use; I am busy' }],
  },
  {
    id: 'qrm',
    text: 'QRM',
    meaning: 'Interference from another station',
    difficulty: 'medium',
    parts: [{ code: 'QRM', meaning: 'other-station interference' }],
  },
  {
    id: 'qrn',
    text: 'QRN',
    meaning: 'Static or atmospheric noise',
    difficulty: 'medium',
    parts: [{ code: 'QRN', meaning: 'static or atmospheric noise' }],
  },
  {
    id: 'qrs',
    text: 'QRS',
    meaning: 'Send slower',
    difficulty: 'medium',
    parts: [{ code: 'QRS', meaning: 'send slower' }],
  },
  {
    id: 'qrq',
    text: 'QRQ',
    meaning: 'Send faster',
    difficulty: 'medium',
    parts: [{ code: 'QRQ', meaning: 'send faster' }],
  },
  {
    id: 'qrt',
    text: 'QRT',
    meaning: 'Stop sending',
    difficulty: 'medium',
    parts: [{ code: 'QRT', meaning: 'stop sending or close the station' }],
  },
  {
    id: 'qrv',
    text: 'QRV',
    meaning: 'Ready',
    difficulty: 'medium',
    parts: [{ code: 'QRV', meaning: 'ready' }],
  },
  {
    id: 'qrz',
    text: 'QRZ',
    meaning: 'Who is calling me?',
    difficulty: 'medium',
    parts: [{ code: 'QRZ', meaning: 'who is calling me?' }],
  },
  {
    id: 'qsl',
    text: 'QSL',
    meaning: 'Receipt acknowledged',
    difficulty: 'medium',
    parts: [{ code: 'QSL', meaning: 'I acknowledge receipt' }],
  },
  {
    id: 'qso',
    text: 'QSO',
    meaning: 'Radio contact',
    difficulty: 'medium',
    parts: [{ code: 'QSO', meaning: 'radio contact or conversation' }],
  },
  {
    id: 'qsy',
    text: 'QSY',
    meaning: 'Change frequency',
    difficulty: 'medium',
    parts: [{ code: 'QSY', meaning: 'change frequency' }],
  },
  {
    id: 'qth',
    text: 'QTH',
    meaning: 'Location',
    difficulty: 'medium',
    parts: [{ code: 'QTH', meaning: 'location' }],
  },
] as const satisfies readonly ListenPhrase[]

export type ListenVocabulary = 'common' | 'q-codes'

// Practice also includes these radio signals. Keep them out of English recognition.
const radioSignals = new Set(['CQ', 'DE', 'QSO', 'QTH', 'QSL', 'RST', 'SOS'])

/** Separate recognition banks, reusing Practice's English vocabulary. */
export const LISTEN_WORD_BANKS: Record<ListenVocabulary, readonly ListenPhrase[]> = {
  common: PRACTICE_WORDS.filter((word) => !radioSignals.has(word)).map((word) => ({
    id: `word-${word.toLowerCase()}`,
    text: word,
    difficulty: word.length <= 4 ? 'short' : word.length <= 6 ? 'medium' : 'long',
    parts: [],
  })),
  'q-codes': LISTEN_PHRASES.filter((word) => /^Q[A-Z]{2}$/.test(word.text)),
}
