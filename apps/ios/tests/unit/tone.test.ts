import { afterEach, describe, expect, it, vi } from 'vitest'
import { playMorseTone, stopMorseTone } from '../../src/utils/tone'

const native = vi.hoisted(() => ({
  playMorseSequence: vi.fn().mockResolvedValue(true),
  stopMorseSequence: vi.fn().mockResolvedValue(true),
  getMorsePlaybackState: vi.fn().mockReturnValue({ elapsedMs: 200, finished: false }),
}))
vi.mock('expo-modules-core', () => ({ requireNativeModule: () => native }))

afterEach(async () => { await stopMorseTone(); vi.useRealTimers() })

describe('native audio completion bridge', () => {
  it('reveals on completed playback, not when scheduling resolves or when paused', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    await playMorseTone({ code: '. -', characterWpm: 20, effectiveWpm: 12, frequency: 700, onComplete })
    expect(native.playMorseSequence).toHaveBeenCalledWith('. -', 60, expect.any(Number), 700, 0.75)
    vi.advanceTimersByTime(5000)
    expect(onComplete).not.toHaveBeenCalled()
    native.getMorsePlaybackState.mockReturnValueOnce({ elapsedMs: 800, finished: true })
    vi.advanceTimersByTime(40)
    expect(onComplete).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('invalidates a completion when playback is stopped', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    await playMorseTone({ code: '.-', onComplete })
    await stopMorseTone()
    native.getMorsePlaybackState.mockReturnValueOnce({ elapsedMs: 800, finished: true })
    vi.advanceTimersByTime(1000)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('does not install a late completion callback after a newer playback starts', async () => {
    vi.useFakeTimers()
    let finishFirst: (started: boolean) => void = () => {}
    native.playMorseSequence.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishFirst = resolve }))
    const firstComplete = vi.fn()
    const secondComplete = vi.fn()
    const first = playMorseTone({ code: '.', onComplete: firstComplete })
    await playMorseTone({ code: '-', onComplete: secondComplete })
    finishFirst(true)
    await first
    native.getMorsePlaybackState.mockReturnValueOnce({ elapsedMs: 800, finished: true })
    vi.advanceTimersByTime(40)
    expect(firstComplete).not.toHaveBeenCalled()
    expect(secondComplete).toHaveBeenCalledOnce()
  })
})
