// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { INTER_CHAR_GAP_MS } from '@dit/core'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useIosConversationSession } from '../../src/hooks/useIosConversationSession'

const mocks = vi.hoisted(() => ({
  send: vi.fn(), create: vi.fn(), play: vi.fn(), stop: vi.fn(), key: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  state: { elapsedMs: 0, durationMs: 1000, finished: false, paused: false },
  appState: { currentState: 'active', addEventListener: vi.fn() },
}))
vi.mock('react-native', () => ({ AppState: mocks.appState }))
vi.mock('../../src/lib/conversationAi', () => ({ createConversation: mocks.create }))
vi.mock('../../src/utils/tone', () => ({
  prepareToneEngine: vi.fn().mockResolvedValue(undefined), startTone: mocks.key,
  stopTone: vi.fn().mockResolvedValue(undefined), playMorseTone: mocks.play, stopMorseTone: mocks.stop,
  getMorsePlaybackState: () => mocks.state, pauseMorseTone: mocks.pause, resumeMorseTone: mocks.resume,
}))
const options = { active: true, blocked: false, characterWpm: 24, toneFrequency: 640 }
let onAppState: (state: string) => void
beforeEach(() => {
  vi.useFakeTimers()
  mocks.state.finished = false
  mocks.state.elapsedMs = 0
  mocks.appState.currentState = 'active'
  mocks.appState.addEventListener.mockImplementation((_name, callback) => { onAppState = callback; return { remove() {} } })
  mocks.create.mockResolvedValue({ send: mocks.send })
  mocks.send.mockResolvedValue('CQ K1ABC K')
  for (const fn of [mocks.play, mocks.stop, mocks.key, mocks.pause, mocks.resume]) fn.mockResolvedValue(undefined)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('native QSO session', () => {
  it('enters silently, follows native completion, and waits indefinitely for the explicit handoff', async () => {
    const { result, unmount } = renderHook(() => useIosConversationSession(options))
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.play).not.toHaveBeenCalled()
    await act(async () => result.current.start())
    expect(result.current.phase).toBe('their-turn-playing')
    expect(mocks.play).toHaveBeenCalledWith(expect.objectContaining({ characterWpm: 24, effectiveWpm: 24 }))
    act(() => { mocks.state.finished = true; vi.advanceTimersByTime(32) })
    expect(result.current.phase).toBe('finishing-copy')
    act(() => { result.current.setTypedCopy('CQ'); vi.advanceTimersByTime(60000) })
    expect(result.current.phase).toBe('finishing-copy')
    expect(result.current.turns).toEqual([])
    act(() => result.current.beginReply())
    expect(result.current.phase).toBe('your-turn')
    expect(result.current.turns).toEqual([{ speaker: 'them', text: 'CQ K1ABC K' }])
    unmount()
  })

  it('checks completed reception before replying without committing or gating the turn', async () => {
    const { result, unmount } = renderHook(() => useIosConversationSession(options))
    await act(async () => result.current.start())
    act(() => result.current.checkCopy())
    expect(result.current.copyWasChecked).toBe(false)
    act(() => { mocks.state.finished = true; vi.advanceTimersByTime(32) })
    act(() => { result.current.setTypedCopy('CQ'); result.current.checkCopy() })
    expect(result.current.copyWasChecked).toBe(true)
    expect(result.current.phase).toBe('finishing-copy')
    expect(result.current.turns).toEqual([])
    act(() => result.current.beginReply())
    expect(result.current.phase).toBe('your-turn')
    expect(result.current.typedCopy).toBe('CQ')
    unmount()
  })

  it('does not play a late station response after backgrounding', async () => {
    let resolve: (text: string) => void = () => {}
    mocks.send.mockImplementation(() => new Promise<string>((done) => { resolve = done }))
    const { result, unmount } = renderHook(() => useIosConversationSession(options))
    let start: Promise<void>
    await act(async () => { start = result.current.start(); await Promise.resolve() })
    act(() => onAppState('background'))
    await act(async () => { resolve('CQ LATE K'); await start! })
    expect(result.current.phase).toBe('ended')
    expect(mocks.play).not.toHaveBeenCalled()
    expect(mocks.resume).not.toHaveBeenCalled()
    unmount()
  })

  it('cancels a held paddle and pending letter when a sheet interrupts the QSO', async () => {
    const { result, rerender, unmount } = renderHook((props) => useIosConversationSession(props), { initialProps: options })
    await act(async () => result.current.start('send'))
    act(() => result.current.handleMorseSymbolPressIn('.'))
    expect(mocks.key).toHaveBeenCalled()
    rerender({ ...options, blocked: true })
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current.phase).toBe('ended')
    expect(result.current.draft).toBe('')
    const calls = mocks.key.mock.calls.length
    act(() => result.current.handleMorseSymbolPressIn('.'))
    expect(mocks.key).toHaveBeenCalledTimes(calls)
    unmount()
  })

  it('lets a keyed reply proceed without copying or grading', async () => {
    const { result, unmount } = renderHook(() => useIosConversationSession(options))
    await act(async () => result.current.start('send'))
    act(() => { result.current.handleKeyPressIn(); result.current.handleKeyPressOut(); vi.advanceTimersByTime(INTER_CHAR_GAP_MS) })
    await act(async () => result.current.sendReply())
    expect(mocks.send).toHaveBeenCalledWith('E')
    expect(result.current.turns[0]).toEqual({ speaker: 'you', text: 'E' })
    expect(result.current.copyWasChecked).toBe(false)
    unmount()
  })
  it('keeps Send first on retry when native initialization fails', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Native setup unavailable'))
    const { result, unmount } = renderHook(() => useIosConversationSession(options))
    await act(async () => result.current.start('send'))
    expect(result.current.phase).toBe('error')
    await act(async () => result.current.retry())
    expect(result.current.phase).toBe('your-turn')
    expect(mocks.send).not.toHaveBeenCalled()
    unmount()
  })

})
