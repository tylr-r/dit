import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { analytics, fireOnce, logEvent, useScreenTracker } from '../../../src/lib/analytics'

describe('analytics adapter', () => {
  let gtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gtag = vi.fn()
    window.gtag = gtag
    window.localStorage.clear()
  })

  afterEach(() => {
    delete window.gtag
  })

  it('forwards typed events through gtag', () => {
    analytics.logEvent('mode_start', { mode: 'practice' })
    expect(gtag).toHaveBeenCalledWith('event', 'mode_start', {
      mode: 'practice',
    })
  })

  it('forwards parameterless events with empty params', () => {
    analytics.logEvent('onboarding_completed')
    expect(gtag).toHaveBeenCalledWith('event', 'onboarding_completed', {})
  })

  it('sets and clears user_id via gtag config', () => {
    analytics.setUserId('user-1')
    expect(gtag).toHaveBeenCalledWith(
      'config',
      expect.any(String),
      expect.objectContaining({ user_id: 'user-1' }),
    )
    analytics.setUserId(null)
    expect(gtag).toHaveBeenCalledWith(
      'config',
      expect.any(String),
      expect.objectContaining({ user_id: undefined }),
    )
  })

  it('no-ops when window.gtag is missing', () => {
    delete window.gtag
    expect(() =>
      analytics.logEvent('mode_start', { mode: 'practice' }),
    ).not.toThrow()
  })

  describe('fireOnce', () => {
    it('runs the callback exactly once across calls', () => {
      const fn = vi.fn()
      fireOnce('test_milestone', fn)
      fireOnce('test_milestone', fn)
      fireOnce('test_milestone', fn)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('uses an isolated namespace per name', () => {
      const fn = vi.fn()
      fireOnce('alpha', fn)
      fireOnce('beta', fn)
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('logEvent shim', () => {
    it('intercepts mode_start and fires first_mode_session once per mode', () => {
      logEvent('mode_start', { mode: 'practice' })
      logEvent('mode_start', { mode: 'practice' })
      const firstSessionCalls = gtag.mock.calls.filter(
        (call) => call[1] === 'first_mode_session',
      )
      expect(firstSessionCalls).toHaveLength(1)
      expect(firstSessionCalls[0][2]).toEqual({ mode: 'practice' })
    })

    it('fires first_mode_session per distinct mode', () => {
      logEvent('mode_start', { mode: 'practice' })
      logEvent('mode_start', { mode: 'listen' })
      const firstSessionCalls = gtag.mock.calls.filter(
        (call) => call[1] === 'first_mode_session',
      )
      expect(firstSessionCalls).toHaveLength(2)
    })

    it('translates mode_correct_answer into a one-shot first_correct_letter per mode without forwarding the source event', () => {
      logEvent('mode_correct_answer', { mode: 'practice' })
      logEvent('mode_correct_answer', { mode: 'practice' })
      logEvent('mode_correct_answer', { mode: 'listen' })
      const first = gtag.mock.calls.filter(
        (c) => c[1] === 'first_correct_letter',
      )
      const passthrough = gtag.mock.calls.filter(
        (c) => c[1] === 'mode_correct_answer',
      )
      expect(first).toHaveLength(2)
      expect(passthrough).toHaveLength(0)
    })
  })
})

describe('useScreenTracker', () => {
  let gtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gtag = vi.fn()
    window.gtag = gtag
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    delete window.gtag
    vi.useRealTimers()
  })

  it('fires screen_view on mount and screen_exit on unmount with positive duration', () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useScreenTracker('practice'))

    expect(gtag).toHaveBeenCalledWith('event', 'screen_view', {
      screen: 'practice',
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    unmount()

    const exitCall = gtag.mock.calls.find((call) => call[1] === 'screen_exit')
    expect(exitCall).toBeDefined()
    expect(exitCall![2]).toMatchObject({ screen: 'practice' })
    expect((exitCall![2] as { duration_ms: number }).duration_ms).toBeGreaterThanOrEqual(1500)
  })

  it('emits exit + view across visibility changes without double counting', () => {
    vi.useFakeTimers()
    renderHook(() => useScreenTracker('listen'))
    gtag.mockClear()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'screen_exit',
      expect.objectContaining({ screen: 'listen' }),
    )

    gtag.mockClear()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(gtag).toHaveBeenCalledWith('event', 'screen_view', {
      screen: 'listen',
    })
  })
})
