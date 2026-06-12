import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'

const mockUseMorseSessionController = vi.hoisted(() => vi.fn())

vi.mock('@dit/core', async () => {
  const actual = await vi.importActual<typeof import('@dit/core')>('@dit/core')
  return {
    ...actual,
    useMorseSessionController: mockUseMorseSessionController,
    useNuxStepTracker: vi.fn(),
    useOnboardingState: () => ({
      dismissSettingsHint: vi.fn(),
      nuxReady: true,
      nuxStatus: 'skipped',
      nuxStep: 'welcome',
    }),
  }
})

vi.mock('../../src/firebase', () => ({
  database: {},
}))

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ authReady: true, user: null }),
}))

vi.mock('../../src/hooks/useCustomListenSession', () => ({
  useCustomListenSession: () => ({
    clear: vi.fn(),
    encoded: { code: '' },
    pause: vi.fn(),
    phase: 'inactive',
    play: vi.fn(),
    playDurationMs: 0,
    replay: vi.fn(),
    restart: vi.fn(),
    resume: vi.fn(),
    reveal: vi.fn(),
    save: vi.fn(),
    setTypedCopy: vi.fn(),
    text: '',
    typedCopy: '',
    workflow: 'listen',
  }),
}))

vi.mock('../../src/components/MorseLiquidSurface', () => ({
  MorseLiquidSurface: () => null,
}))

const makeSession = (status: 'idle' | 'success' | 'error') => ({
  state: {
    bestWpm: undefined,
    customLetters: [],
    dailyActivity: {},
    didCompleteSoundCheck: false,
    freestyleWordMode: false,
    guidedCourseActive: false,
    guidedMaxPackReached: 0,
    guidedPackIndex: 0,
    guidedPhase: 'teach',
    guidedProgress: {},
    isPressing: false,
    learnerProfile: null,
    letterAccuracy: {},
    listenEffectiveWpm: 18,
    listenStatus: 'idle',
    listenTtr: {},
    listenWavePlayback: null,
    listenWpm: 18,
    maxLevel: 26,
    mode: 'practice',
    practiceAutoPlay: true,
    practiceIfrMode: true,
    practiceLearnMode: true,
    practiceReviewMisses: true,
    practiceWord: '',
    practiceWordIndex: 0,
    practiceWordMode: false,
    scores: {},
    showHint: true,
    showMnemonic: false,
    status,
    streak: undefined,
    toneFrequency: 650,
    tutorialHoldCount: 0,
    tutorialTapCount: 0,
  },
  setters: {
    flushPendingSave: vi.fn(),
    setHapticsEnabled: vi.fn(),
    setPracticeAutoPlay: vi.fn(),
    setShowHint: vi.fn(),
    setShowMnemonic: vi.fn(),
  },
  derived: {
    activeLetters: ['E'],
    guidedCurrentPack: ['E'],
    guidedPracticeStatusDetailText: null,
    hintVisible: true,
    isFreestyle: false,
    isGuidedLessonModeMismatch: false,
    isGuidedListenActive: false,
    isGuidedPracticeActive: false,
    isListen: false,
    letterPlaceholder: false,
    listenStatusDetailTokens: null,
    listenTtrText: null,
    mnemonicVisible: false,
    practiceWord: '',
    practiceWordIndex: 0,
    practiceWpmText: null,
    showMorseHint: false,
    showPracticeWord: false,
    showSettingsHint: false,
    canRequestOneTimeHint: false,
    stageLetter: 'E',
    stagePips: [{ type: 'dot', state: status === 'success' ? 'hit' : 'expected' }],
    statusText: status === 'success' ? 'Correct' : ' ',
  },
  handlers: {
    handleCreateAccountWithEmail: vi.fn(),
    handleDeleteAccount: vi.fn(),
    handleFinishKnownTour: vi.fn(),
    handleFreestyleClear: vi.fn(),
    handleIntroPressIn: vi.fn(),
    handleRequestOneTimeHint: vi.fn(),
    handleListenReplay: vi.fn(),
    handleMaxLevelChange: vi.fn(),
    handleModeChange: vi.fn(),
    handleMorseSymbolPressIn: vi.fn(),
    handleMorseSymbolPressOut: vi.fn(),
    handleNuxChooseProfile: vi.fn(),
    handleNuxCompleteButtonTutorial: vi.fn(),
    handleNuxContinueFromSoundCheck: vi.fn(),
    handleNuxContinueFromStages: vi.fn(),
    handleNuxPlaySoundCheck: vi.fn(),
    handleNuxSkipReminder: vi.fn(),
    handleNuxWelcomeDone: vi.fn(),
    handlePracticeIfrModeChange: vi.fn(),
    handlePracticeLearnModeChange: vi.fn(),
    handlePracticeReplay: vi.fn(),
    handlePracticeReviewMissesChange: vi.fn(),
    handlePracticeWordModeChange: vi.fn(),
    handlePressOut: vi.fn(),
    handleReplayNux: vi.fn(),
    handleResetApp: vi.fn(),
    handleResetScores: vi.fn(),
    handleSelectCustomLetters: vi.fn(),
    handleSetGuidedCourseActive: vi.fn(),
    handleSignInWithApple: vi.fn(),
    handleSignInWithEmail: vi.fn(),
    handleSignInWithGoogle: vi.fn(),
    handleStartBeginnerCourse: vi.fn(),
    handleToneFrequencyChange: vi.fn(),
    handleUseRecommended: vi.fn(),
    handleListenWpmChange: vi.fn(),
    moveIntoGuidedLesson: vi.fn(),
    submitListenAnswer: vi.fn(),
  },
})

describe('App', () => {
  beforeEach(() => {
    mockUseMorseSessionController.mockReturnValue(makeSession('success'))
  })

  it('applies the practice answer status to the app shell', () => {
    render(<App />)

    expect(document.querySelector('.app')).toHaveClass('status-success')
  })

  it('applies missed practice status to the app shell', () => {
    mockUseMorseSessionController.mockReturnValue(makeSession('error'))

    render(<App />)

    expect(document.querySelector('.app')).toHaveClass('status-error')
  })

  it('reopens settings after a successful settings sign-in', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })
  })
})
