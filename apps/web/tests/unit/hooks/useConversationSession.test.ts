import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useConversationSession,
  type UseConversationSessionOptions,
} from '../../../src/hooks/useConversationSession'

const { startConversationMock, sendTurnMock } = vi.hoisted(() => ({
  startConversationMock: vi.fn(),
  sendTurnMock: vi.fn(),
}))

vi.mock('../../../src/lib/conversationAi', () => ({
  ConversationAiError: class ConversationAiError extends Error {},
  startConversation: startConversationMock,
  sendTurn: sendTurnMock,
}))

const baseOptions = (): UseConversationSessionOptions => ({
  toneFrequency: 600,
  characterWpm: 20,
  prepareToneEngine: vi.fn().mockResolvedValue(undefined),
  playMorseTone: vi.fn().mockResolvedValue(undefined),
  stopMorseTone: vi.fn().mockResolvedValue(undefined),
  pauseAudioContext: vi.fn().mockResolvedValue(undefined),
  resumeAudioContext: vi.fn().mockResolvedValue(undefined),
  getPlaybackElapsedMs: vi.fn().mockReturnValue(999999),
  startTone: vi.fn().mockResolvedValue(undefined),
  stopTone: vi.fn().mockResolvedValue(undefined),
})

beforeEach(() => {
  startConversationMock.mockReset().mockReturnValue({})
  sendTurnMock.mockReset()
  // A stub that resolves synchronously so the completion-watcher effect
  // (which reads getPlaybackElapsedMs vs. the just-computed duration) fires
  // on the very next tick instead of needing a real animation frame.
  // jsdom already provides a working cancelAnimationFrame; only
  // requestAnimationFrame needs to become synchronous for tests.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useConversationSession', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useConversationSession(baseOptions()))
    expect(result.current.phase).toBe('idle')
    expect(result.current.turns).toEqual([])
  })

  it('opens the keying workbench without requesting a transmission when sending first', async () => {
    const opts = baseOptions()
    const { result } = renderHook(() => useConversationSession(opts))

    await act(async () => {
      await result.current.start('send')
    })

    expect(opts.prepareToneEngine).toHaveBeenCalledOnce()
    expect(startConversationMock).toHaveBeenCalledWith({
      callsign: expect.stringMatching(/^[KNW]\d[A-Z]{3}$/),
    })
    expect(sendTurnMock).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('your-turn')
  })

  it('uses the universal WPM for received character and spacing speed', async () => {
    sendTurnMock.mockResolvedValueOnce('CQ TEST')
    const opts = {
      ...baseOptions(),
      characterWpm: 24,
      effectiveWpm: 8,
    }
    const { result } = renderHook(() => useConversationSession(opts))

    await act(async () => {
      await result.current.start('receive')
      await Promise.resolve()
    })

    expect(opts.playMorseTone).toHaveBeenCalledWith(
      expect.objectContaining({
        characterWpm: 24,
        effectiveWpm: 24,
      }),
    )
  })

  it('keeps copy available after playback until the operator checks it', async () => {
    sendTurnMock.mockResolvedValueOnce('CQ CQ DE W1AW W1AW K')
    const opts = baseOptions()
    const { result } = renderHook(() => useConversationSession(opts))

    await act(async () => {
      await result.current.start('receive')
      await Promise.resolve()
    })

    expect(startConversationMock).toHaveBeenCalledWith({
      callsign: expect.stringMatching(/^[KNW]\d[A-Z]{3}$/),
    })
    expect(opts.prepareToneEngine).toHaveBeenCalledOnce()
    expect(opts.playMorseTone).toHaveBeenCalled()
    expect(result.current.phase).toBe('your-turn')
    expect(result.current.turns).toEqual([
      { speaker: 'them', text: 'CQ CQ DE W1AW W1AW K' },
    ])

    act(() => {
      result.current.checkCopy()
    })

    expect(result.current.copyWasChecked).toBe(true)
  })

  it('opens keying as soon as playback ends without requiring a copy check', async () => {
    sendTurnMock.mockResolvedValueOnce('KM7DFG DE K7JWA K')
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const { result } = renderHook(() => useConversationSession(baseOptions()))

    await act(async () => {
      await result.current.start('receive')
      await Promise.resolve()
    })

    expect(result.current.phase).toBe('your-turn')

    act(() => result.current.handleKeyPressIn())
    expect(result.current.replyStarted).toBe(true)
    act(() => {
      result.current.handleKeyPressOut()
      vi.advanceTimersByTime(400)
    })

    expect(result.current.draft.trim()).toBe('E')
    expect(result.current.copyWasChecked).toBe(false)
  })

  it('uses a different callsign for the next QSO', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    sendTurnMock.mockResolvedValue('CQ TEST')
    const { result } = renderHook(() => useConversationSession(baseOptions()))

    await act(async () => {
      await result.current.start()
      result.current.reset()
      await result.current.start()
    })

    expect(startConversationMock).toHaveBeenNthCalledWith(1, { callsign: 'K0AAA' })
    expect(startConversationMock).toHaveBeenNthCalledWith(2, { callsign: 'K0AAB' })
  })

  it('start() surfaces an error phase when the AI call fails', async () => {
    sendTurnMock.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useConversationSession(baseOptions()))

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.errorMessage).toBeTruthy()
  })

  it('keys a dit and commits it to the draft after the letter gap', async () => {
    sendTurnMock.mockResolvedValueOnce('K')
    vi.useFakeTimers()
    // vi.useFakeTimers() replaces requestAnimationFrame with its own
    // virtual-clock version, clobbering the synchronous stub from
    // beforeEach — reapply it so the completion-watcher effect still fires
    // without needing to advance timers by an rAF-specific amount.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const { result } = renderHook(() => useConversationSession(baseOptions()))

    await act(async () => {
      await result.current.start()
      await Promise.resolve()
    })
    act(() => result.current.checkCopy())
    expect(result.current.phase).toBe('your-turn')

    act(() => {
      result.current.handleKeyPressIn()
      result.current.handleKeyPressOut()
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    expect(result.current.draft.trim()).toBe('E')
  })

  it('accepts a physical paddle symbol without inferring it from hold duration', async () => {
    sendTurnMock.mockResolvedValueOnce('K')
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const { result } = renderHook(() => useConversationSession(baseOptions()))

    await act(async () => {
      await result.current.start()
      await Promise.resolve()
    })
    act(() => result.current.checkCopy())

    act(() => result.current.handleMorseSymbolPressIn('-'))
    expect(result.current.replyStarted).toBe(true)
    act(() => {
      result.current.handleMorseSymbolPressOut('-')
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.draft.trim()).toBe('T')
  })

  it('sendReply appends the reply, requests the next turn, and plays it', async () => {
    sendTurnMock.mockResolvedValueOnce('K').mockResolvedValueOnce('R FB 73')
    const opts = baseOptions()
    vi.useFakeTimers()
    // vi.useFakeTimers() replaces requestAnimationFrame with its own
    // virtual-clock version, clobbering the synchronous stub from
    // beforeEach — reapply it so the completion-watcher effect still fires
    // without needing to advance timers by an rAF-specific amount.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const { result } = renderHook(() => useConversationSession(opts))

    await act(async () => {
      await result.current.start()
      await Promise.resolve()
    })
    act(() => result.current.checkCopy())

    act(() => {
      result.current.handleKeyPressIn()
      result.current.handleKeyPressOut()
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.draft.trim()).toBe('E')

    await act(async () => {
      await result.current.sendReply()
      await Promise.resolve()
    })

    expect(sendTurnMock).toHaveBeenLastCalledWith({}, 'E')
    expect(result.current.turns).toEqual([
      { speaker: 'them', text: 'K' },
      { speaker: 'you', text: 'E' },
      { speaker: 'them', text: 'R FB 73' },
    ])
    expect(opts.playMorseTone).toHaveBeenCalledTimes(2)
  })

  it('clears typed copy before each incoming transmission', async () => {
    sendTurnMock.mockResolvedValueOnce('CQ TEST').mockResolvedValueOnce('R FB')
    const { result } = renderHook(() => useConversationSession(baseOptions()))

    await act(async () => {
      await result.current.start()
      await Promise.resolve()
    })
    act(() => result.current.checkCopy())

    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    act(() => {
      result.current.setTypedCopy('CQ TEST')
      result.current.handleKeyPressIn()
      result.current.handleKeyPressOut()
    })

    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await act(async () => {
      await result.current.sendReply()
      await Promise.resolve()
    })

    expect(result.current.typedCopy).toBe('')
  })

  it('restores the shared audio context when ending from a paused turn', async () => {
    sendTurnMock.mockResolvedValueOnce('CQ TEST')
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    const opts = baseOptions()
    const { result } = renderHook(() => useConversationSession(opts))

    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      await result.current.pause()
    })
    act(() => {
      result.current.end()
    })

    expect(opts.pauseAudioContext).toHaveBeenCalledOnce()
    expect(opts.resumeAudioContext).toHaveBeenCalledOnce()
  })

  it('prepares the audio engine again when replay is requested', async () => {
    sendTurnMock.mockResolvedValueOnce('CQ TEST')
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    const opts = baseOptions()
    const { result } = renderHook(() => useConversationSession(opts))

    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      await result.current.replay()
    })

    expect(opts.prepareToneEngine).toHaveBeenCalledTimes(2)
  })
})
