// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createNoopPlatform, PlatformProvider, type Platform } from '../../src/platform'

// Mock the firebase progress-sync hook so the controller's internal
// useProgressSyncController doesn't attempt to reach Firebase in tests.
const firebaseSyncMocks = {
  remoteLoaded: false,
  saveNow: vi.fn(),
  deleteRemoteProgress: vi.fn(async () => {}),
}
vi.mock('../../src/hooks/useFirebaseProgressSync', () => ({
  useFirebaseProgressSync: () => firebaseSyncMocks,
}))

// Import AFTER the mock so the controller picks up the mocked hook.
import {
  useMorseSessionController,
  type UseMorseSessionControllerCallbacks,
  type UseMorseSessionControllerOptions,
} from '../../src/hooks/useMorseSessionController'

const platform: Platform = createNoopPlatform()

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(PlatformProvider, { value: platform }, children)

const makeCallbacks = (): UseMorseSessionControllerCallbacks => ({
  logAnalyticsEvent: vi.fn(),
  ensureNotificationPermission: vi.fn(async () => true),
  prepareToneEngine: vi.fn(),
  startTone: vi.fn(),
  stopTone: vi.fn(),
  playMorseTone: vi.fn(),
  stopMorseTone: vi.fn(),
  playOnboardingTone: vi.fn(),
})

const makeOnboarding = (): UseMorseSessionControllerOptions['onboarding'] => ({
  introHintStep: 'morse',
  nuxStatus: 'completed',
  nuxStep: 'welcome',
  nuxReady: true,
  learnerProfile: null,
  setLearnerProfile: vi.fn(),
  didCompleteSoundCheck: false,
  setDidCompleteSoundCheck: vi.fn(),
  tutorialTapCount: 0,
  setTutorialTapCount: vi.fn(),
  tutorialHoldCount: 0,
  setTutorialHoldCount: vi.fn(),
  persistIntroHintStep: vi.fn(),
  persistNuxStatus: vi.fn(),
  dismissMorseHint: vi.fn(),
  dismissSettingsHint: vi.fn(),
  setNuxStatus: vi.fn(),
  setNuxStep: vi.fn(),
})

const makeOptions = (
  overrides: Partial<UseMorseSessionControllerOptions> = {},
): UseMorseSessionControllerOptions => ({
  user: null,
  database: {} as UseMorseSessionControllerOptions['database'],
  isDeletingAccount: false,
  setIsDeletingAccount: vi.fn(),
  showReference: false,
  setShowSettings: vi.fn(),
  setShowAbout: vi.fn(),
  setShowReference: vi.fn(),
  showPhaseModal: vi.fn(),
  onboarding: makeOnboarding(),
  callbacks: makeCallbacks(),
  ...overrides,
})

describe('useMorseSessionController', () => {
  it('mounts without throwing and returns the expected API surface', () => {
    const options = makeOptions()

    const { result } = renderHook(() => useMorseSessionController(options), { wrapper })

    expect(result.current).toBeDefined()
    expect(result.current.state).toBeDefined()
    expect(result.current.setters).toBeDefined()
    expect(result.current.derived).toBeDefined()
    expect(result.current.handlers).toBeDefined()

    // Initial session is practice mode with idle listen state.
    expect(result.current.state.mode).toBe('practice')
    expect(result.current.state.listenStatus).toBe('idle')
    expect(result.current.state.guidedCourseActive).toBe(false)

    // Handlers the host app wires up must all be callable functions.
    expect(typeof result.current.handlers.handleModeChange).toBe('function')
    expect(typeof result.current.handlers.handlePressOut).toBe('function')
    expect(typeof result.current.handlers.handleIntroPressIn).toBe('function')
    expect(typeof result.current.handlers.handleListenReplay).toBe('function')
    expect(typeof result.current.handlers.handlePracticeReplay).toBe('function')
    expect(typeof result.current.handlers.submitListenAnswer).toBe('function')
    expect(typeof result.current.handlers.handleMaxLevelChange).toBe('function')
    expect(typeof result.current.handlers.handleUseRecommended).toBe('function')
    expect(typeof result.current.handlers.resetProgressState).toBe('function')
    expect(typeof result.current.handlers.moveIntoGuidedLesson).toBe('function')

    // Setters/flush exposed back to the shell.
    expect(typeof result.current.setters.flushPendingSave).toBe('function')
    expect(typeof result.current.setters.setShowHint).toBe('function')
  })

  it('does not invoke firebase saveNow when user is null', () => {
    firebaseSyncMocks.saveNow.mockReset()
    const options = makeOptions({ user: null })

    renderHook(() => useMorseSessionController(options), { wrapper })

    expect(firebaseSyncMocks.saveNow).not.toHaveBeenCalled()
  })

  it('derives listen mode flags from the initial practice state', () => {
    const options = makeOptions()
    const { result } = renderHook(() => useMorseSessionController(options), { wrapper })

    expect(result.current.derived.isFreestyle).toBe(false)
    expect(result.current.derived.isListen).toBe(false)
    expect(result.current.derived.isGuidedPracticeActive).toBe(false)
    expect(result.current.derived.isGuidedListenActive).toBe(false)
    expect(Array.isArray(result.current.derived.activeLetters)).toBe(true)
    expect(result.current.derived.activeLetters.length).toBeGreaterThan(0)
  })
})
