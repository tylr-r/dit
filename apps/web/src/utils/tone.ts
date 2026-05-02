import {
  AUDIO_FREQUENCY,
  AUDIO_VOLUME,
  getFarnsworthUnitMs,
  getListenUnitMs,
} from '@dit/core'
import { createAudioContext } from '../platform/audio'

type ToneDefaults = {
  frequency?: number
  volume?: number
}

const clampVolume = (value: number) => Math.min(1, Math.max(0.4, value))

let contextRef: AudioContext | null = null
let holdOscillator: OscillatorNode | null = null
let holdGain: GainNode | null = null
let morseNodes: { oscillator: OscillatorNode; gain: GainNode } | null = null
let graphWarmed = false
let firstPrimedSoundDone = false

const ensureContext = async (): Promise<AudioContext | null> => {
  if (!contextRef) {
    contextRef = createAudioContext()
  }
  if (!contextRef) {
    return null
  }
  if (contextRef.state === 'suspended') {
    try {
      await contextRef.resume()
    } catch {
      return null
    }
  }
  return contextRef
}

const warmAudioGraph = (context: AudioContext) => {
  if (graphWarmed) {
    return
  }
  graphWarmed = true
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  oscillator.connect(gain)
  gain.connect(context.destination)
  const startTime = context.currentTime
  const stopTime = startTime + 0.08
  oscillator.start(startTime)
  oscillator.stop(stopTime)
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
  }
}

const getScheduleHeadroom = (context: AudioContext) => {
  const latency =
    (typeof context.outputLatency === 'number' ? context.outputLatency : 0) ||
    (typeof context.baseLatency === 'number' ? context.baseLatency : 0)
  return Math.max(0.12, latency + 0.05)
}

const createToneNodes = (
  context: AudioContext,
  frequency: number,
  initialGain: number,
) => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(initialGain, context.currentTime)
  oscillator.connect(gain)
  gain.connect(context.destination)
  return { oscillator, gain }
}

const scheduleEnvelope = (
  gain: GainNode,
  toneGain: number,
  startTime: number,
  durationSeconds: number,
  rampSeconds: number,
) => {
  const endTime = startTime + durationSeconds
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(toneGain, startTime + rampSeconds)
  gain.gain.setValueAtTime(toneGain, endTime - rampSeconds)
  gain.gain.linearRampToValueAtTime(0, endTime)
}

export const prepareToneEngine = async () => {
  const context = await ensureContext()
  if (context) {
    warmAudioGraph(context)
  }
}

export const startTone = async ({ frequency, volume }: ToneDefaults = {}) => {
  const context = await ensureContext()
  if (!context || holdOscillator) {
    return
  }
  const resolvedFrequency = frequency ?? AUDIO_FREQUENCY
  const resolvedVolume = clampVolume(volume ?? AUDIO_VOLUME)
  const { oscillator, gain } = createToneNodes(context, resolvedFrequency, 0)
  const startTime = context.currentTime
  const lookahead = firstPrimedSoundDone ? 0 : 0.04
  const effectiveStart = startTime + lookahead
  gain.gain.setValueAtTime(0, effectiveStart)
  gain.gain.linearRampToValueAtTime(resolvedVolume, effectiveStart + 0.005)
  oscillator.start(effectiveStart)
  firstPrimedSoundDone = true
  holdOscillator = oscillator
  holdGain = gain
}

export const stopTone = async () => {
  const context = contextRef
  const oscillator = holdOscillator
  const gain = holdGain
  if (!context || !oscillator || !gain) {
    holdOscillator = null
    holdGain = null
    return
  }
  const endTime = context.currentTime + 0.01
  gain.gain.cancelScheduledValues(context.currentTime)
  gain.gain.setValueAtTime(gain.gain.value, context.currentTime)
  gain.gain.linearRampToValueAtTime(0, endTime)
  oscillator.stop(endTime + 0.01)
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
  }
  holdOscillator = null
  holdGain = null
}

export const playMorseTone = async ({
  code,
  characterWpm = 20,
  effectiveWpm,
  minUnitMs = 40,
  frequency,
  volume,
}: {
  code: string
  characterWpm?: number
  effectiveWpm?: number
  minUnitMs?: number
  frequency?: number
  volume?: number
}) => {
  const context = await ensureContext()
  if (!context) {
    return
  }
  await stopMorseTone()
  const resolvedFrequency = frequency ?? AUDIO_FREQUENCY
  const resolvedVolume = clampVolume(volume ?? AUDIO_VOLUME)
  const characterUnitMs = getListenUnitMs(characterWpm, minUnitMs)
  const resolvedEffectiveWpm = Math.min(characterWpm, effectiveWpm ?? characterWpm)
  const farnsworthUnitMs = getFarnsworthUnitMs(
    characterWpm,
    resolvedEffectiveWpm,
    minUnitMs,
  )
  const characterUnitSeconds = characterUnitMs / 1000
  const farnsworthUnitSeconds = farnsworthUnitMs / 1000
  const interCharacterGapSeconds = farnsworthUnitSeconds * 3
  const interWordGapSeconds = farnsworthUnitSeconds * 7
  warmAudioGraph(context)
  const { oscillator, gain } = createToneNodes(context, resolvedFrequency, 0)
  morseNodes = { oscillator, gain }
  const rampSeconds = 0.005
  const startOffset = getScheduleHeadroom(context)
  let cursor = context.currentTime + startOffset
  const tokens = code
    .split(' ')
    .filter((token) => token === '/' || /[.-]/.test(token))
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (token === '/') {
      cursor += interWordGapSeconds
      continue
    }
    const symbols = token.split('').filter((s) => s === '.' || s === '-')
    for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex += 1) {
      const symbol = symbols[symbolIndex]
      const duration =
        symbol === '.' ? characterUnitSeconds : characterUnitSeconds * 3
      scheduleEnvelope(gain, resolvedVolume, cursor, duration, rampSeconds)
      cursor += duration
      if (symbolIndex < symbols.length - 1) {
        cursor += characterUnitSeconds
      }
    }
    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1] !== '/') {
      cursor += interCharacterGapSeconds
    }
  }
  const oscillatorStart = firstPrimedSoundDone
    ? context.currentTime
    : Math.max(context.currentTime, cursor - 0.04)
  oscillator.start(oscillatorStart)
  oscillator.stop(cursor + 0.05)
  firstPrimedSoundDone = true
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
    if (morseNodes?.oscillator === oscillator) {
      morseNodes = null
    }
  }
}

export const stopMorseTone = async () => {
  const context = contextRef
  const nodes = morseNodes
  if (!context || !nodes) {
    morseNodes = null
    return
  }
  try {
    nodes.oscillator.stop()
  } catch {
    // Already stopped.
  }
  nodes.oscillator.disconnect()
  nodes.gain.disconnect()
  morseNodes = null
}
