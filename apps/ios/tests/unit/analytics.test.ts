// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireOnce,
  logAnalyticsEvent,
  resetAnalyticsMilestonesForTests,
  setAnalyticsEnabledForTests,
  useAnalyticsScreenTracker,
} from '../../src/analytics'

const mocks = vi.hoisted(() => ({
  getApp: vi.fn(() => ({})),
  getAnalytics: vi.fn(() => ({})),
  logEvent: vi.fn(() => Promise.resolve()),
  logScreenView: vi.fn(() => Promise.resolve()),
  setUserId: vi.fn(() => Promise.resolve()),
  setUserProperty: vi.fn(() => Promise.resolve()),
}))

vi.mock('@react-native-firebase/app', () => ({
  getApp: mocks.getApp,
}))

vi.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: mocks.getAnalytics,
  logEvent: mocks.logEvent,
  logScreenView: mocks.logScreenView,
  setUserId: mocks.setUserId,
  setUserProperty: mocks.setUserProperty,
}))

const storage = new Map<string, string>()
const mockedStorage = vi.mocked(AsyncStorage)
const eventCalls = () =>
  mocks.logEvent.mock.calls as unknown as Array<[
    unknown,
    string,
    Record<string, unknown> | undefined,
  ]>

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
  setAnalyticsEnabledForTests(true)
  resetAnalyticsMilestonesForTests()
  mockedStorage.getItem.mockImplementation(async (key) => storage.get(key) ?? null)
  mockedStorage.setItem.mockImplementation(async (key, value) => {
    storage.set(key, value)
  })
})

describe('iOS analytics adapter', () => {
  it('does not fire Firebase events or persist milestones when analytics are disabled', async () => {
    setAnalyticsEnabledForTests(false)

    logAnalyticsEvent('mode_start', { mode: 'practice' })
    logAnalyticsEvent('mode_correct_answer', { mode: 'practice' })
    const { unmount } = renderHook(() => useAnalyticsScreenTracker('practice'))
    await flush()
    unmount()
    await flush()

    expect(mocks.logEvent).not.toHaveBeenCalled()
    expect(mocks.logScreenView).not.toHaveBeenCalled()
    expect(mockedStorage.setItem).not.toHaveBeenCalled()
  })

  it('does not fire Firebase events by default under the test runner', async () => {
    setAnalyticsEnabledForTests(null)

    logAnalyticsEvent('mode_start', { mode: 'practice' })
    await flush()

    expect(mocks.logEvent).not.toHaveBeenCalled()
  })

  it('persists fireOnce milestones through AsyncStorage', async () => {
    const fire = vi.fn()

    fireOnce('first_mode_session:practice', fire)
    await flush()
    fireOnce('first_mode_session:practice', fire)
    await flush()

    expect(fire).toHaveBeenCalledTimes(1)
  })

  it('keeps mode_start and emits first_mode_session once per mode', async () => {
    logAnalyticsEvent('mode_start', { mode: 'practice' })
    logAnalyticsEvent('mode_start', { mode: 'practice' })
    await flush()

    expect(mocks.logEvent).toHaveBeenCalledWith(expect.anything(), 'mode_start', {
      mode: 'practice',
      app_surface: 'ios',
    })
    const firstSessionCalls = eventCalls().filter(
      (call) => call[1] === 'first_mode_session',
    )
    expect(firstSessionCalls).toHaveLength(1)
    expect(firstSessionCalls[0][2]).toEqual({
      mode: 'practice',
      app_surface: 'ios',
    })
  })

  it('translates mode_correct_answer into one first_correct_letter per mode', async () => {
    logAnalyticsEvent('mode_correct_answer', { mode: 'practice' })
    logAnalyticsEvent('mode_correct_answer', { mode: 'practice' })
    logAnalyticsEvent('mode_correct_answer', { mode: 'listen' })
    await flush()

    const firstCorrectCalls = eventCalls().filter(
      (call) => call[1] === 'first_correct_letter',
    )
    const rawCorrectCalls = eventCalls().filter(
      (call) => call[1] === 'mode_correct_answer',
    )
    expect(firstCorrectCalls).toHaveLength(2)
    expect(rawCorrectCalls).toHaveLength(0)
  })

  it('logs screen_view, Firebase screen name, and screen_exit around a screen', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useAnalyticsScreenTracker('practice'))
    await flush()

    expect(mocks.logEvent).toHaveBeenCalledWith(expect.anything(), 'screen_view', {
      screen: 'practice',
      app_surface: 'ios',
    })
    expect(mocks.logScreenView).toHaveBeenCalledWith(expect.anything(), {
      screen_name: 'practice',
      screen_class: 'practice',
    })

    act(() => {
      vi.advanceTimersByTime(900)
      unmount()
    })

    expect(mocks.logEvent).toHaveBeenCalledWith(expect.anything(), 'screen_exit', {
      screen: 'practice',
      duration_ms: 900,
      app_surface: 'ios',
    })
    vi.useRealTimers()
  })
})
