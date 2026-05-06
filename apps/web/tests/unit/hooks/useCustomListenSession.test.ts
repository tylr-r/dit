import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCustomListenSession,
  type UseCustomListenSessionOptions,
} from '../../../src/hooks/useCustomListenSession'

const TEXT_KEY = 'dit-listen-custom-text-v1'
const TYPEALONG_KEY = 'dit-listen-custom-typealong-v1'
const ACTIVE_KEY = 'dit-listen-custom-active-v1'

const baseOptions = (): UseCustomListenSessionOptions => ({
  isListenMode: true,
  characterWpm: 20,
  effectiveWpm: 20,
  toneFrequency: 600,
  playMorseTone: vi.fn().mockResolvedValue(undefined),
  stopMorseTone: vi.fn().mockResolvedValue(undefined),
  pauseAudioContext: vi.fn().mockResolvedValue(undefined),
  resumeAudioContext: vi.fn().mockResolvedValue(undefined),
})

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCustomListenSession', () => {
  it('starts in the inactive phase when no saved text', () => {
    const { result } = renderHook(() => useCustomListenSession(baseOptions()))
    expect(result.current.phase).toBe('inactive')
    expect(result.current.text).toBe('')
  })

  it('enters setup phase after save with non-empty text', () => {
    const { result } = renderHook(() => useCustomListenSession(baseOptions()))
    act(() => {
      result.current.save({ text: 'sos', typeAlong: true })
    })
    expect(result.current.phase).toBe('setup')
    expect(result.current.text).toBe('SOS')
    expect(result.current.workflow).toBe('typealong')
    expect(localStorage.getItem(TEXT_KEY)).toBe('SOS')
    expect(localStorage.getItem(TYPEALONG_KEY)).toBe('on')
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('true')
  })

  it('returns to inactive when saving empty text', () => {
    const { result } = renderHook(() => useCustomListenSession(baseOptions()))
    act(() => result.current.save({ text: 'sos', typeAlong: true }))
    act(() => result.current.save({ text: '   ', typeAlong: true }))
    expect(result.current.phase).toBe('inactive')
    expect(result.current.text).toBe('')
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('false')
  })

  it('calls playMorseTone with the encoded code when play is invoked', async () => {
    const opts = baseOptions()
    const { result } = renderHook(() => useCustomListenSession(opts))
    act(() => result.current.save({ text: 'sos', typeAlong: false }))
    await act(async () => {
      await result.current.play()
    })
    expect(opts.playMorseTone).toHaveBeenCalledWith(
      expect.objectContaining({
        code: '... --- ...',
        characterWpm: 20,
        effectiveWpm: 20,
        frequency: 600,
      }),
    )
    expect(result.current.phase).toBe('playing')
  })

  it('exposes playDurationMs after save', () => {
    const opts = baseOptions()
    const { result } = renderHook(() => useCustomListenSession(opts))
    act(() => result.current.save({ text: 'sos', typeAlong: false }))
    expect(result.current.playDurationMs).toBeGreaterThan(0)
  })

  it('reveal moves the phase to reveal regardless of playback state', async () => {
    const opts = baseOptions()
    const { result } = renderHook(() => useCustomListenSession(opts))
    act(() => result.current.save({ text: 'sos', typeAlong: false }))
    await act(async () => {
      await result.current.play()
    })
    await act(async () => {
      await result.current.reveal()
    })
    expect(result.current.phase).toBe('reveal')
  })

  it('stop returns to setup and calls stopMorseTone', async () => {
    const opts = baseOptions()
    const { result } = renderHook(() => useCustomListenSession(opts))
    act(() => result.current.save({ text: 'sos', typeAlong: true }))
    await act(async () => {
      await result.current.play()
    })
    await act(async () => {
      await result.current.stop()
    })
    expect(opts.stopMorseTone).toHaveBeenCalled()
    expect(result.current.phase).toBe('setup')
  })

  it('hydrates from localStorage when isListenMode flips on', () => {
    localStorage.setItem(TEXT_KEY, 'HI')
    localStorage.setItem(TYPEALONG_KEY, 'off')
    localStorage.setItem(ACTIVE_KEY, 'true')

    const { result, rerender } = renderHook(
      ({ isListen }) =>
        useCustomListenSession({ ...baseOptions(), isListenMode: isListen }),
      { initialProps: { isListen: false } },
    )
    expect(result.current.phase).toBe('inactive')
    rerender({ isListen: true })
    expect(result.current.phase).toBe('setup')
    expect(result.current.text).toBe('HI')
    expect(result.current.workflow).toBe('listenonly')
  })

  it('clear() exits custom mode entirely', () => {
    const { result } = renderHook(() => useCustomListenSession(baseOptions()))
    act(() => result.current.save({ text: 'hello', typeAlong: true }))
    act(() => result.current.clear())
    expect(result.current.phase).toBe('inactive')
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('false')
  })

  it('setTypedCopy updates the typed buffer without changing phase', () => {
    const { result } = renderHook(() => useCustomListenSession(baseOptions()))
    act(() => result.current.save({ text: 'hi', typeAlong: true }))
    act(() => result.current.setTypedCopy('h'))
    expect(result.current.typedCopy).toBe('h')
    expect(result.current.phase).toBe('setup')
  })
})
