import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const setUserActivation = (
  hasBeenActive: boolean,
  isActive = hasBeenActive,
) => {
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value: { hasBeenActive, isActive },
  })
}

const installFakeAudioContext = (): FakeContext & { constructorCalls: unknown[] } => {
  const oscillators: FakeOscillator[] = []
  const gains: FakeGain[] = []
  const constructorCalls: unknown[] = []
  const ctx: FakeContext & { constructorCalls: unknown[] } = {
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
    constructorCalls,
  }
  ;(globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    function FakeAudioContextCtor(options?: AudioContextOptions) {
      constructorCalls.push(options ?? null)
      return ctx
    } as unknown as typeof AudioContext
  ;(window as unknown as { AudioContext: typeof AudioContext }).AudioContext = (
    globalThis as unknown as { AudioContext: typeof AudioContext }
  ).AudioContext
  return ctx
}

describe('playMorseTone', () => {
  it('reports natural audio completion, not scheduling or cancellation', async () => {
    const ctx = installFakeAudioContext()
    const { playMorseTone, stopMorseTone } = await import('../../../src/utils/tone')
    const onComplete = vi.fn()
    await playMorseTone({ code: '.-', onComplete })
    expect(onComplete).not.toHaveBeenCalled()
    ctx.oscillators.at(-1)!.onended!()
    expect(onComplete).toHaveBeenCalledOnce()

    onComplete.mockClear()
    await playMorseTone({ code: '.-', onComplete })
    const cancelledOscillator = ctx.oscillators.at(-1)!
    await stopMorseTone()
    cancelledOscillator.onended!()
    expect(onComplete).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    setUserActivation(true)
    window.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()
    await Promise.resolve()
    vi.useRealTimers()
    Reflect.deleteProperty(navigator, 'userActivation')
  })

  it('does not create an AudioContext while the page has no user activation', async () => {
    const ctx = installFakeAudioContext()
    setUserActivation(false)
    const { prepareToneEngine } = await import('../../../src/utils/tone')

    await prepareToneEngine()

    expect(ctx.constructorCalls).toHaveLength(0)
  })

  it('requests an interactive AudioContext for low-latency keying', async () => {
    const ctx = installFakeAudioContext()
    const { startTone } = await import('../../../src/utils/tone')

    await startTone({ frequency: 600 })

    expect(ctx.constructorCalls[0]).toEqual({ latencyHint: 'interactive' })
  })

  it('warms the AudioContext on the next user gesture after skipped preparation', async () => {
    const ctx = installFakeAudioContext()
    setUserActivation(false)
    const { prepareToneEngine } = await import('../../../src/utils/tone')

    await prepareToneEngine()
    expect(ctx.constructorCalls).toHaveLength(0)

    setUserActivation(true)
    window.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()
    await Promise.resolve()

    expect(ctx.constructorCalls).toHaveLength(1)
    expect(ctx.oscillators).toHaveLength(1)
  })

  it('retries a stale pending resume during a new user gesture', async () => {
    const ctx = installFakeAudioContext()
    ctx.state = 'suspended'
    let resolveFirstResume: (() => void) | null = null
    ctx.resume = vi.fn(() => {
      if (!resolveFirstResume) {
        return new Promise<void>((resolve) => {
          resolveFirstResume = resolve
        })
      }
      ctx.state = 'running'
      return Promise.resolve()
    })
    const { prepareToneEngine } = await import('../../../src/utils/tone')

    setUserActivation(true, false)
    const stalePreparation = prepareToneEngine()
    await Promise.resolve()

    setUserActivation(true, true)
    const retryPreparation = prepareToneEngine()
    await Promise.resolve()

    expect(ctx.resume).toHaveBeenCalledTimes(2)
    await retryPreparation
    resolveFirstResume!()
    await stalePreparation
  })

  it('schedules the hold tone immediately while AudioContext resume is pending', async () => {
    const ctx = installFakeAudioContext()
    ctx.state = 'suspended'
    let resumeResolve: (() => void) | null = null
    ctx.resume = vi.fn(() => {
      ctx.state = 'running'
      return new Promise<void>((resolve) => {
        resumeResolve = () => {
          resolve()
        }
      })
    })
    const { startTone } = await import('../../../src/utils/tone')

    const startPromise = startTone({ frequency: 600 })
    await Promise.resolve()

    const holdOscillator = ctx.oscillators.find((osc) => osc.frequency.value === 600)
    expect(ctx.resume).toHaveBeenCalledTimes(1)
    expect(holdOscillator?.startCalls).toHaveLength(1)

    resumeResolve!()
    await startPromise
  })

  it('keeps a cold first tap audible when release happens before AudioContext resumes', async () => {
    vi.useFakeTimers()
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
    const { startTone, stopTone } = await import('../../../src/utils/tone')

    await startTone({ frequency: 600 })
    const holdOscillator = ctx.oscillators.find((osc) => osc.frequency.value === 600)
    expect(holdOscillator?.startCalls).toHaveLength(1)

    await stopTone()
    expect(holdOscillator?.stopCalls).toHaveLength(0)

    resumeResolve!()
    await Promise.resolve()
    await Promise.resolve()
    expect(holdOscillator?.stopCalls).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(60)
    expect(holdOscillator?.stopCalls).toHaveLength(1)
  })

  it('starts a fresh hold tone when pressed again before the cold resume stop completes', async () => {
    vi.useFakeTimers()
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
    const { startTone, stopTone } = await import('../../../src/utils/tone')

    await startTone({ frequency: 600 })
    const firstHoldOscillator = ctx.oscillators.find((osc) => osc.frequency.value === 600)

    await stopTone()
    await startTone({ frequency: 600 })

    const holdOscillators = ctx.oscillators.filter((osc) => osc.frequency.value === 600)
    const secondHoldOscillator = holdOscillators[1]
    expect(holdOscillators).toHaveLength(2)
    expect(firstHoldOscillator?.stopCalls).toHaveLength(1)
    expect(secondHoldOscillator?.startCalls).toHaveLength(1)

    resumeResolve!()
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(60)

    expect(secondHoldOscillator?.stopCalls).toHaveLength(0)
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
