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
let playbackAudioStartTime: number | null = null

// Bumped every time a play is requested or an external stop happens. A pending
// playMorseTone that's still waiting on AudioContext.resume() (page-load
// auto-play) compares its captured token after each await; if it diverged, the
// call aborts so it can't overlap with whatever the user just did.
let morsePlayToken = 0

const cleanupMorseNodes = () => {
  const nodes = morseNodes
  morseNodes = null
  if (!nodes) {
    return
  }
  try {
    nodes.oscillator.stop()
  } catch {
    // Already stopped.
  }
  nodes.oscillator.disconnect()
  nodes.gain.disconnect()
}

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

/**
 * Nominal playback-start offset in ms: the headroom added before the first
 * scheduled envelope. Used by the custom-listen hook to align the RAF
 * progress clock with audible audio rather than the scheduling call.
 */
export const PLAYBACK_START_OFFSET_MS = 150

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
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(resolvedVolume, startTime + 0.005)
  oscillator.start(startTime)
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
  const myToken = ++morsePlayToken
  const context = await ensureContext()
  if (!context || myToken !== morsePlayToken) {
    return
  }
  cleanupMorseNodes()
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
  const audioStartTime = context.currentTime + startOffset
  playbackAudioStartTime = audioStartTime
  let cursor = audioStartTime
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
  oscillator.start(context.currentTime)
  oscillator.stop(cursor + 0.05)
  oscillator.onended = () => {
    oscillator.disconnect()
    gain.disconnect()
    if (morseNodes?.oscillator === oscillator) {
      morseNodes = null
    }
  }
}

export const stopMorseTone = async () => {
  morsePlayToken += 1
  playbackAudioStartTime = null
  cleanupMorseNodes()
}

/** Suspend the AudioContext clock, pausing all scheduled audio in place. */
export const pauseAudioContext = async () => {
  if (contextRef && contextRef.state === 'running') {
    await contextRef.suspend()
  }
}

/** Resume a suspended AudioContext, continuing scheduled audio from where it paused. */
export const resumeAudioContext = async () => {
  if (contextRef && contextRef.state === 'suspended') {
    await contextRef.resume()
  }
}

/** AudioContext.currentTime at the moment the most recent playback's first audible envelope was scheduled, or null if no playback in progress. */
export const getPlaybackAudioStartTime = (): number | null => playbackAudioStartTime

/** Returns the AudioContext.currentTime, or null if no context exists. */
export const getAudioContextCurrentTime = (): number | null =>
  contextRef ? contextRef.currentTime : null

/** Elapsed ms since playback's first audible envelope, clamped to [0, ∞). Returns null if no playback active. */
export const getPlaybackElapsedMs = (): number | null => {
  if (playbackAudioStartTime === null || !contextRef) return null
  const elapsed = (contextRef.currentTime - playbackAudioStartTime) * 1000
  return elapsed < 0 ? 0 : elapsed
}
