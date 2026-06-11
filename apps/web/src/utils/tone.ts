import {
  AUDIO_FREQUENCY,
  getFarnsworthUnitMs,
  getListenUnitMs,
  resolveToneVolume,
} from '@dit/core'
import { createAudioContext } from '../platform/audio'

type ToneDefaults = {
  frequency?: number
  volume?: number
}

let contextRef: AudioContext | null = null
let holdOscillator: OscillatorNode | null = null
let holdGain: GainNode | null = null
let morseNodes: { oscillator: OscillatorNode; gain: GainNode } | null = null
let graphWarmed = false
let playbackAudioStartTime: number | null = null
let userActivationWarmupRegistered = false
let contextResumePromise: Promise<void> | null = null
// A quick first tap can release before Chrome has finished waking Web Audio.
// In that case, keep the hold tone alive briefly after resume so it is audible.
let pendingSuspendedHoldStop = false
let suspendedHoldStopTimeout: ReturnType<typeof globalThis.setTimeout> | null = null

const hasUserActivatedPage = () =>
  typeof navigator === 'undefined' ||
  !('userActivation' in navigator) ||
  navigator.userActivation.hasBeenActive

const warmPreparedToneEngine = async () => {
  const context = await ensureContext()
  if (context) {
    warmAudioGraph(context)
  }
}

const registerUserActivationWarmup = () => {
  if (userActivationWarmupRegistered || typeof window === 'undefined') {
    return
  }
  userActivationWarmupRegistered = true
  const options: AddEventListenerOptions = { capture: true, once: true, passive: true }
  const removeListeners = () => {
    window.removeEventListener('pointerdown', handleActivation, options)
    window.removeEventListener('keydown', handleActivation, options)
    window.removeEventListener('touchstart', handleActivation, options)
  }
  const handleActivation = () => {
    userActivationWarmupRegistered = false
    removeListeners()
    if (hasUserActivatedPage()) {
      void warmPreparedToneEngine()
    }
  }
  window.addEventListener('pointerdown', handleActivation, options)
  window.addEventListener('keydown', handleActivation, options)
  window.addEventListener('touchstart', handleActivation, options)
}

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

const cleanupHoldNodes = (oscillator: OscillatorNode, gain: GainNode) => {
  try {
    oscillator.stop()
  } catch {
    // Already stopped.
  }
  oscillator.disconnect()
  gain.disconnect()
}

const clearSuspendedHoldStopTimeout = () => {
  if (suspendedHoldStopTimeout === null) {
    return
  }
  globalThis.clearTimeout(suspendedHoldStopTimeout)
  suspendedHoldStopTimeout = null
}

const getOrCreateContext = (): AudioContext | null => {
  if (!contextRef) {
    contextRef = createAudioContext()
  }
  return contextRef
}

const resumeContext = (context: AudioContext) => {
  if (context.state !== 'suspended') {
    return Promise.resolve()
  }
  if (!contextResumePromise) {
    contextResumePromise = context
      .resume()
      .finally(() => {
        contextResumePromise = null
      })
  }
  return contextResumePromise
}

const ensureContext = async (): Promise<AudioContext | null> => {
  const context = getOrCreateContext()
  if (!context) {
    return null
  }
  try {
    await resumeContext(context)
  } catch {
    return null
  }
  return context
}

const warmAudioGraph = (context: AudioContext) => {
  if (graphWarmed || holdOscillator) {
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
  if (!hasUserActivatedPage()) {
    registerUserActivationWarmup()
    return
  }
  await warmPreparedToneEngine()
}

export const startTone = async ({ frequency, volume }: ToneDefaults = {}) => {
  const context = getOrCreateContext()
  if (!context) {
    return
  }
  if (holdOscillator) {
    const canReplaceHold =
      pendingSuspendedHoldStop || suspendedHoldStopTimeout !== null
    if (!canReplaceHold) {
      return
    }
    const staleOscillator = holdOscillator
    const staleGain = holdGain
    clearSuspendedHoldStopTimeout()
    pendingSuspendedHoldStop = false
    holdOscillator = null
    holdGain = null
    if (staleGain) {
      cleanupHoldNodes(staleOscillator, staleGain)
    }
  }
  const wasSuspended = context.state === 'suspended'
  const resumePromise = resumeContext(context)
  const resolvedFrequency = frequency ?? AUDIO_FREQUENCY
  const resolvedVolume = resolveToneVolume(volume)
  const { oscillator, gain } = createToneNodes(context, resolvedFrequency, 0)
  const startTime = context.currentTime
  pendingSuspendedHoldStop = false
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(resolvedVolume, startTime + 0.005)
  oscillator.start(startTime)
  holdOscillator = oscillator
  holdGain = gain
  void resumePromise
    .then(() => {
      if (!wasSuspended || holdOscillator !== oscillator || !pendingSuspendedHoldStop) {
        return
      }
      pendingSuspendedHoldStop = false
      suspendedHoldStopTimeout = globalThis.setTimeout(() => {
        suspendedHoldStopTimeout = null
        if (holdOscillator === oscillator) {
          void stopTone()
        }
      }, 60)
    })
    .catch(() => {
      if (holdOscillator === oscillator) {
        holdOscillator = null
        holdGain = null
        oscillator.disconnect()
        gain.disconnect()
      }
    })
}

export const stopTone = async () => {
  clearSuspendedHoldStopTimeout()
  const context = contextRef
  const oscillator = holdOscillator
  const gain = holdGain
  if (!context || !oscillator || !gain) {
    holdOscillator = null
    holdGain = null
    return
  }
  if (context.state === 'suspended' || contextResumePromise) {
    pendingSuspendedHoldStop = true
    return
  }
  pendingSuspendedHoldStop = false
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
  const resolvedVolume = resolveToneVolume(volume)
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
