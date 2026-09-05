import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'

const mockUseMorseSessionController = vi.hoisted(() => vi.fn())
const mockUseListenPhraseSession = vi.hoisted(() => vi.fn())
const playMorseToneMock = vi.hoisted(() => vi.fn())

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
)

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

vi.mock('../../src/utils/tone', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/tone')>(
    '../../src/utils/tone',
  )
  return {
    ...actual,
    playMorseTone: playMorseToneMock,
  }
})

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

vi.mock('../../src/hooks/useListenPhraseSession', () => ({
  useListenPhraseSession: mockUseListenPhraseSession,
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
    setCharacterListenSuspended: vi.fn(),
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

const makeListenSession = () => {
  const session = makeSession('idle')
  return {
    ...session,
    state: {
      ...session.state,
      mode: 'listen',
    },
    derived: {
      ...session.derived,
      activeLetters: Object.keys(
        // Use the public data shape without importing a second copy into this test.
        // The word-session hook is mocked, so the exact values only establish
        // that Listen has a complete character set.
        {
          A: true, B: true, C: true, D: true, E: true, F: true, G: true,
          H: true, I: true, J: true, K: true, L: true, M: true, N: true,
          O: true, P: true, Q: true, R: true, S: true, T: true, U: true,
          V: true, W: true, X: true, Y: true, Z: true,
        },
      ),
      isListen: true,
      stageLetter: 'E',
      statusText: ' ',
    },
  }
}

const makePhraseSession = (ready = false) => ({
  isAvailable: true,
  isPlaying: false,
  round: ready ? null : {
    target: {
      id: 'qrs',
      text: 'QRS',
      meaning: 'Send slower',
      difficulty: 'medium',
      parts: [{ code: 'QRS', meaning: 'send slower' }],
    },
    options: [
      { id: 'qrs', text: 'QRS', meaning: '', difficulty: 'medium', parts: [] },
      { id: 'qrm', text: 'QRM', meaning: '', difficulty: 'medium', parts: [] },
      { id: 'qrn', text: 'QRN', meaning: '', difficulty: 'medium', parts: [] },
      { id: 'qrl', text: 'QRL', meaning: '', difficulty: 'medium', parts: [] },
    ],
  },
  status: 'idle',
  selectedPhraseId: null,
  attemptCount: 0,
  correctCount: 0,
  playback: null,
  start: vi.fn().mockResolvedValue(undefined),
  submitAnswer: vi.fn().mockResolvedValue(undefined),
  replay: vi.fn().mockResolvedValue(undefined),
  next: vi.fn().mockResolvedValue(undefined),
  release: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
})

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/app')
    localStorage.clear()
    playMorseToneMock.mockReset()
    mockUseMorseSessionController.mockReset()
    mockUseMorseSessionController.mockReturnValue(makeSession('success'))
    mockUseListenPhraseSession.mockReset()
    mockUseListenPhraseSession.mockReturnValue(makePhraseSession())
  })

  it('renders the public homepage at the root path', () => {
    window.history.replaceState(null, '', '/')

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Learn Morse code by\u00a0ear.' }),
    ).toBeInTheDocument()
  })

  it('applies the practice answer status to the app shell', () => {
    render(<App />)

    expect(document.querySelector('.app')).toHaveClass('status-success')
  })

  it('opens Conversation directly at the QSO route', () => {
    window.history.replaceState(null, '', '/app/qso')

    render(<App />)

    expect(
      screen.getByRole('group', {
        name: 'Do you want to send or receive first?',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send first' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Receive first' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mode', exact: true })).toHaveTextContent(
      'Conversation',
    )
  })

  it('keeps shared practice audio silent when Conversation loads directly', () => {
    window.history.replaceState(null, '', '/app/qso')

    render(<App />)

    const options = mockUseMorseSessionController.mock.calls[0][0]
    options.callbacks.playMorseTone({ code: '.', unitMs: 60 })
    expect(playMorseToneMock).not.toHaveBeenCalled()
  })

  it('keeps shared playback enabled outside Conversation', () => {
    render(<App />)

    const options = mockUseMorseSessionController.mock.calls[0][0]
    options.callbacks.playMorseTone({ code: '.', unitMs: 60 })
    expect(playMorseToneMock).toHaveBeenCalledOnce()
  })

  it('updates the URL when Conversation is selected', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Mode', exact: true }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Conversation/ }))

    expect(window.location.pathname).toBe('/app/qso')
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

  it('keeps Words mode quiet until the learner starts listening', () => {
    const session = makeListenSession()
    const phraseSession = makePhraseSession(true)
    mockUseMorseSessionController.mockReturnValue(session)
    mockUseListenPhraseSession.mockReturnValue(phraseSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Words' }))

    expect(phraseSession.start).not.toHaveBeenCalled()
    expect(session.handlers.setCharacterListenSuspended).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeInTheDocument()
    expect(document.querySelector('.listen-overlay-letter')).not.toBeInTheDocument()
    expect(localStorage.getItem('dit-listen-content-v1')).toBe('phrases')

    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
    expect(phraseSession.start).toHaveBeenCalledOnce()
  })

  it('switches vocabulary without starting audio and remembers the choice', () => {
    const phraseSession = makePhraseSession(true)
    mockUseMorseSessionController.mockReturnValue(makeListenSession())
    mockUseListenPhraseSession.mockReturnValue(phraseSession)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Words' }))
    expect(screen.getByRole('button', { name: 'Common words' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Q codes' }))
    expect(screen.getByRole('button', { name: 'Q codes' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('dit-listen-vocabulary-v1')).toBe('q-codes')
    expect(phraseSession.release).toHaveBeenCalledOnce()
    expect(phraseSession.start).not.toHaveBeenCalled()
    expect(mockUseListenPhraseSession.mock.lastCall?.[0].phrases.every(
      (word: { text: string }) => /^Q[A-Z]{2}$/.test(word.text),
    )).toBe(true)
  })

  it('keeps the vocabulary selector available when the saved bank is locked', () => {
    localStorage.setItem('dit-listen-content-v1', 'phrases')
    localStorage.setItem('dit-listen-vocabulary-v1', 'q-codes')
    const session = makeListenSession()
    session.derived.activeLetters = ['T', 'E', 'A', 'M']
    mockUseMorseSessionController.mockReturnValue(session)
    mockUseListenPhraseSession.mockReturnValue({ ...makePhraseSession(true), isAvailable: false })
    render(<App />)
    expect(screen.getByRole('button', { name: 'Q codes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Common words' })).toBeEnabled()
  })

  it('restores the saved Listen content when returning to Listen', async () => {
    const phraseSession = makePhraseSession(true)
    localStorage.setItem('dit-listen-content-v1', 'phrases')
    mockUseMorseSessionController.mockReturnValue(makeListenSession())
    mockUseListenPhraseSession.mockReturnValue(phraseSession)

    render(<App />)

    expect(screen.getByRole('button', { name: 'Words' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(phraseSession.start).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeInTheDocument()
  })

  it('suppresses the character prompt before entering a saved Words mode', () => {
    const session = makeSession('idle')
    session.derived.activeLetters = ['T', 'E', 'A', 'M']
    localStorage.setItem('dit-listen-content-v1', 'phrases')
    mockUseMorseSessionController.mockReturnValue(session)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Mode', exact: true }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Listen/ }))

    expect(session.handlers.setCharacterListenSuspended).toHaveBeenCalledWith(true)
    expect(
      session.handlers.setCharacterListenSuspended.mock.invocationCallOrder[0],
    ).toBeLessThan(session.handlers.handleModeChange.mock.invocationCallOrder[0])
  })

  it('does not submit letter answers while Listen Words is active', () => {
    const session = makeListenSession()
    mockUseMorseSessionController.mockReturnValue(session)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Words' }))
    fireEvent.keyDown(window, { key: 'A' })

    expect(session.handlers.submitListenAnswer).not.toHaveBeenCalled()
  })

  it('does not accept number shortcuts until the word finishes playing', () => {
    const phraseSession = { ...makePhraseSession(), isPlaying: true }
    mockUseMorseSessionController.mockReturnValue(makeListenSession())
    mockUseListenPhraseSession.mockReturnValue(phraseSession)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Words' }))
    fireEvent.keyDown(window, { key: '1' })
    expect(phraseSession.submitAnswer).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Answer QRS' })).not.toBeInTheDocument()
  })

  it('restores character playback after word audio stops', async () => {
    const session = makeListenSession()
    const phraseSession = makePhraseSession()
    mockUseMorseSessionController.mockReturnValue(session)
    mockUseListenPhraseSession.mockReturnValue(phraseSession)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Words' }))
    fireEvent.click(screen.getByRole('button', { name: 'Characters' }))

    await waitFor(() => {
      expect(phraseSession.stop).toHaveBeenCalledOnce()
      expect(session.handlers.setCharacterListenSuspended).toHaveBeenCalledWith(false)
      expect(session.handlers.handleListenReplay).toHaveBeenCalledOnce()
    })
  })

  it('falls back to Characters when browser storage cannot be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    mockUseMorseSessionController.mockReturnValue(makeListenSession())

    render(<App />)

    expect(screen.getByRole('button', { name: 'Characters' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    getItem.mockRestore()
  })

  it('releases word state without stopping audio after another mode takes over', async () => {
    const phraseSession = makePhraseSession()
    mockUseMorseSessionController.mockReturnValue(makeListenSession())
    mockUseListenPhraseSession.mockReturnValue(phraseSession)
    const view = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Words' }))

    mockUseMorseSessionController.mockReturnValue(makeSession('idle'))
    view.rerender(<App />)

    await waitFor(() => {
      expect(phraseSession.release).toHaveBeenCalledOnce()
    })
    expect(phraseSession.stop).not.toHaveBeenCalled()
  })
})
