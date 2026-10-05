// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCustomListenSession } from '../../src/hooks/useCustomListenSession'
import { getMorsePlaybackState, pauseMorseTone, playMorseTone, resumeMorseTone, stopMorseTone } from '../../src/utils/tone'

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@dit/core', async (original) => ({ ...await original<typeof import('@dit/core')>(), usePlatform: () => ({ storage }) }))
vi.mock('../../src/utils/tone', () => ({
  playMorseTone: vi.fn().mockResolvedValue(undefined), stopMorseTone: vi.fn().mockResolvedValue(undefined),
  pauseMorseTone: vi.fn().mockResolvedValue(undefined), resumeMorseTone: vi.fn().mockResolvedValue(undefined),
  getMorsePlaybackState: vi.fn(),
}))

const options = { characterWpm: 20, effectiveWpm: 12, toneFrequency: 720 }
const setup = () => renderHook(() => useCustomListenSession(options))

beforeEach(() => {
  storage.getItem.mockResolvedValue(null)
  vi.mocked(getMorsePlaybackState).mockReturnValue({ elapsedMs: 800, durationMs: 1000, paused: false, finished: false })
})

describe('custom Listen on iOS', () => {
  it('hydrates saved text silently and normalizes it locally', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({ text: 'cq! cq', typeAlong: false }))
    const { result } = setup()
    await act(async () => {})
    expect(result.current.text).toBe('CQ CQ')
    expect(result.current.typeAlong).toBe(false)
    expect(result.current.phase).toBe('setup')
    expect(playMorseTone).not.toHaveBeenCalled()
  })

  it('plays with global speed and pitch, retaining copy across pause and resume', async () => {
    const { result } = setup()
    await act(async () => {})
    await act(async () => result.current.save('ten! net', true))
    await act(async () => result.current.play())
    expect(playMorseTone).toHaveBeenLastCalledWith({ code: '- . -. / -. . -', characterWpm: 20, effectiveWpm: 12, frequency: 720 })
    act(() => result.current.setTypedCopy('TEN'))
    await act(async () => result.current.pause())
    expect(pauseMorseTone).toHaveBeenCalledOnce()
    expect(result.current.elapsedMs).toBe(800)
    expect(result.current.phase).toBe('paused')
    await act(async () => result.current.resume())
    expect(resumeMorseTone).toHaveBeenCalledOnce()
    expect(result.current.typedCopy).toBe('TEN')
    await act(async () => result.current.reveal())
    expect(result.current.phase).toBe('reveal')
    expect(result.current.typedCopy).toBe('TEN')
    expect(storage.setItem).toHaveBeenCalledOnce()
  })

  it('reveals only when native audio reports completion, including trailing spacing', async () => {
    vi.useFakeTimers()
    const { result, unmount } = setup()
    await act(async () => {})
    await act(async () => result.current.save('TEN', true))
    await act(async () => result.current.play())
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.phase).toBe('playing')
    vi.mocked(getMorsePlaybackState).mockReturnValue({ elapsedMs: 1000, durationMs: 1000, paused: false, finished: true })
    act(() => vi.advanceTimersByTime(60))
    expect(result.current.phase).toBe('reveal')
    unmount()
    vi.useRealTimers()
  })

  it('cancels pending playback when the learner leaves', async () => {
    let finishStop = () => {}
    const { result } = setup()
    await act(async () => {})
    await act(async () => result.current.save('TEN', true))
    vi.mocked(stopMorseTone).mockImplementationOnce(() => new Promise<void>((resolve) => { finishStop = resolve }))
    let pending: Promise<void>
    act(() => { pending = result.current.play() })
    await act(async () => result.current.stop())
    await act(async () => { finishStop(); await pending })
    expect(playMorseTone).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('setup')
  })
})
