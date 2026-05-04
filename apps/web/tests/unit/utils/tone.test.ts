import { beforeEach, describe, expect, it, vi } from 'vitest'

type GainEvent =
  | { kind: 'setValueAtTime'; value: number; time: number }
  | { kind: 'linearRamp'; value: number; time: number }
  | { kind: 'cancel'; time: number }

type FakeOscillator = {
  type: string
  frequency: { value: number }
  startCalls: number[]
  stopCalls: number[]
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  onended: (() => void) | null
  start: (when?: number) => void
  stop: (when?: number) => void
}

type FakeGain = {
  events: GainEvent[]
  gain: {
    value: number
    setValueAtTime: (value: number, time: number) => void
    linearRampToValueAtTime: (value: number, time: number) => void
    cancelScheduledValues: (time: number) => void
  }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

type FakeContext = {
  state: 'suspended' | 'running' | 'closed'
  currentTime: number
  destination: object
  baseLatency: number
  outputLatency: number
  oscillators: FakeOscillator[]
  gains: FakeGain[]
  resume: () => Promise<void>
  createOscillator: () => FakeOscillator
  createGain: () => FakeGain
}

const installFakeAudioContext = (): FakeContext => {
  const oscillators: FakeOscillator[] = []
  const gains: FakeGain[] = []
  const ctx: FakeContext = {
    state: 'running',
    currentTime: 0,
    destination: {},
    baseLatency: 0,
    outputLatency: 0,
    oscillators,
    gains,
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    createOscillator: () => {
      const osc: FakeOscillator = {
        type: 'sine',
        frequency: { value: 0 },
        startCalls: [],
        stopCalls: [],
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null,
        start(when = 0) {
          this.startCalls.push(when)
        },
        stop(when = 0) {
          this.stopCalls.push(when)
        },
      }
      oscillators.push(osc)
      return osc
    },
    createGain: () => {
      const events: GainEvent[] = []
      const gain: FakeGain = {
        events,
        gain: {
          value: 1,
          setValueAtTime(value: number, time: number) {
            events.push({ kind: 'setValueAtTime', value, time })
          },
          linearRampToValueAtTime(value: number, time: number) {
            events.push({ kind: 'linearRamp', value, time })
          },
          cancelScheduledValues(time: number) {
            events.push({ kind: 'cancel', time })
          },
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(gain)
      return gain
    },
  }
  ;(globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    function FakeAudioContextCtor() {
      return ctx
    } as unknown as typeof AudioContext
  ;(window as unknown as { AudioContext: typeof AudioContext }).AudioContext = (
    globalThis as unknown as { AudioContext: typeof AudioContext }
  ).AudioContext
  return ctx
}

describe('playMorseTone', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('starts the oscillator before (or at) the first gain envelope event on the first call after page load', async () => {
    const ctx = installFakeAudioContext()
    const { playMorseTone } = await import('../../../src/utils/tone')

    await playMorseTone({
      code: '.',
      characterWpm: 12,
      effectiveWpm: 12,
      minUnitMs: 40,
      frequency: 600,
    })

    // The morse oscillator is the second one (the first is from warmAudioGraph).
    expect(ctx.oscillators.length).toBeGreaterThanOrEqual(2)
    const morseOsc = ctx.oscillators[ctx.oscillators.length - 1]
    const morseGain = ctx.gains[ctx.gains.length - 1]

    expect(morseOsc.startCalls).toHaveLength(1)
    const startTime = morseOsc.startCalls[0]

    // First scheduled envelope event marks when audible audio begins.
    const firstEnvelopeEvent = morseGain.events.find(
      (event) => event.kind === 'setValueAtTime' && event.time > 0,
    )
    expect(firstEnvelopeEvent).toBeDefined()

    // Oscillator must already be running by the time the gain envelope opens,
    // otherwise the user hears nothing (or only the very tail of the schedule).
    expect(startTime).toBeLessThanOrEqual(firstEnvelopeEvent!.time)
  })

  it('does not start a morse oscillator when stopMorseTone is called while a playMorseTone call is awaiting AudioContext resume', async () => {
    const ctx = installFakeAudioContext()
    ctx.state = 'suspended'
    let resumeResolve: (() => void) | null = null
    ctx.resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resumeResolve = () => {
            ctx.state = 'running'
            resolve()
          }
        }),
    )
    const { playMorseTone, stopMorseTone } = await import('../../../src/utils/tone')

    // Auto-play scheduled while page is loading and AudioContext is still suspended.
    const playPromise = playMorseTone({
      code: '.',
      characterWpm: 12,
      effectiveWpm: 12,
      minUnitMs: 40,
      frequency: 600,
    })

    // User presses spacebar — handler calls stopMorseTone before kicking off
    // the hold tone. This must cancel the pending auto-play.
    await stopMorseTone()

    // The gesture allows AudioContext.resume() to complete.
    resumeResolve!()

    await playPromise

    const morseOscillators = ctx.oscillators.filter(
      (osc) => osc.frequency.value === 600,
    )
    for (const osc of morseOscillators) {
      expect(osc.startCalls).toHaveLength(0)
    }
  })
})
