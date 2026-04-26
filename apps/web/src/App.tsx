import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { Footer } from './components/Footer'
import { LearningSheet } from './components/LearningSheet'
import { SignInSheet } from './components/SignInSheet'
import {
  PrivacyPolicy,
  SupportPage,
  TermsOfService,
} from './components/LegalPage'
import { ListenControls } from './components/ListenControls'
import { MorseButton } from './components/MorseButton'
import { NuxModal } from './components/NuxModal'
import { Page404 } from './components/Page404'
import { PhaseModal } from './components/PhaseModal'
import { ReferenceModal } from './components/ReferenceModal'
import { SettingsPanel } from './components/SettingsPanel'
import { StageDisplay } from './components/StageDisplay'
import {
  BEGINNER_COURSE_PACKS,
  DEFAULT_CHARACTER_WPM,
  LISTEN_MIN_UNIT_MS,
  LISTEN_WPM_MAX,
  LISTEN_WPM_MIN,
  MORSE_DATA,
  REFERENCE_LETTERS,
  REFERENCE_NUMBERS,
  REFERENCE_WPM,
  TONE_FREQUENCY_RANGE,
  computeHero,
  createGuidedLessonProgress,
  todayStreakContribution,
  useMorseSessionController,
  useOnboardingState,
  type Letter,
} from '@dit/core'
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth'
import { database } from './firebase'
import { useAuth } from './hooks/useAuth'
import { usePhaseModalState } from './hooks/usePhaseModalState'
import {
  playMorseTone,
  prepareToneEngine,
  startTone,
  stopMorseTone,
  stopTone,
} from './utils/tone'

const playOnboardingTone = (symbol: '.' | '-') => {
  void playMorseTone({
    code: symbol,
    characterWpm: DEFAULT_CHARACTER_WPM,
    effectiveWpm: DEFAULT_CHARACTER_WPM,
    minUnitMs: LISTEN_MIN_UNIT_MS,
  })
}

const trackEvent = (event: string, params?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !window.gtag) {
    return
  }
  window.gtag('event', event, params ?? {})
}

const ensureNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }
  if (Notification.permission === 'granted') {
    return true
  }
  if (Notification.permission === 'denied') {
    return false
  }
  const result = await Notification.requestPermission()
  return result === 'granted'
}

const sessionCallbacks = {
  logAnalyticsEvent: trackEvent,
  ensureNotificationPermission,
  prepareToneEngine,
  startTone,
  stopTone,
  playMorseTone,
  stopMorseTone,
  playOnboardingTone,
}

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  if (!element) {
    return false
  }
  return (
    element.isContentEditable ||
    element.tagName === 'INPUT' ||
    element.tagName === 'SELECT' ||
    element.tagName === 'TEXTAREA'
  )
}

const shouldIgnoreShortcutEvent = (event: KeyboardEvent) =>
  event.repeat ||
  event.ctrlKey ||
  event.metaKey ||
  event.altKey ||
  isEditableTarget(event.target)

function MainApp() {
  const { user } = useAuth()
  const onboarding = useOnboardingState()
  const { phaseModal, showPhaseModal, handlePhaseModalDismiss } =
    usePhaseModalState()
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLearning, setShowLearning] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const [useCustomKeyboard, setUseCustomKeyboard] = useState(false)
  const [soundCheckStatus, setSoundCheckStatus] = useState<'idle' | 'playing'>(
    'idle',
  )
  const morseButtonRef = useRef<HTMLButtonElement | null>(null)
  const isPressingRef = useRef(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)

  const session = useMorseSessionController({
    user,
    database,
    isDeletingAccount,
    setIsDeletingAccount,
    showReference,
    setShowSettings,
    setShowAbout,
    setShowReference,
    showPhaseModal,
    onboarding,
    callbacks: sessionCallbacks,
  })
  const { state, derived, handlers, setters } = session
  const {
    mode,
    showHint,
    showMnemonic,
    practiceWordMode,
    freestyleWordMode,
    practiceWord,
    practiceWordIndex,
    listenStatus,
    listenWpm,
    toneFrequency,
    scores,
    isPressing,
    learnerProfile,
    bestWpm,
    streak,
    letterAccuracy,
    dailyActivity,
    guidedCourseActive,
    guidedPackIndex,
    guidedMaxPackReached,
    customLetters,
    guidedPhase,
    practiceAutoPlay,
    practiceLearnMode,
    practiceIfrMode,
    practiceReviewMisses,
  } = state
  const {
    isFreestyle,
    isListen,
    statusText,
    stageLetter,
    hintVisible,
    letterPlaceholder,
    practiceWpmText,
    listenTtrText,
    guidedCurrentPack,
  } = derived

  useEffect(() => {
    isPressingRef.current = isPressing
  }, [isPressing])

  const { nuxReady, nuxStatus } = onboarding
  const isNuxActive = nuxReady && nuxStatus === 'pending'

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const updateAppHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight
      const heightValue = `${height}px`
      document.documentElement.style.setProperty('--app-height', heightValue)
      document.documentElement.style.height = heightValue
      if (document.body) {
        document.body.style.height = heightValue
      }
      if (window.scrollY) {
        window.scrollTo(0, 0)
      }
    }
    updateAppHeight()
    window.addEventListener('resize', updateAppHeight)
    window.visualViewport?.addEventListener('resize', updateAppHeight)
    window.visualViewport?.addEventListener('scroll', updateAppHeight)
    return () => {
      window.removeEventListener('resize', updateAppHeight)
      window.visualViewport?.removeEventListener('resize', updateAppHeight)
      window.visualViewport?.removeEventListener('scroll', updateAppHeight)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    const update = () => {
      setUseCustomKeyboard(mediaQuery.matches)
    }
    update()
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update)
    } else {
      mediaQuery.addListener(update)
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', update)
      } else {
        mediaQuery.removeListener(update)
      }
    }
  }, [])

  useEffect(() => {
    const button = morseButtonRef.current
    if (!button) {
      return
    }
    const preventTouchDefault = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault()
      }
    }
    const preventContextMenu = (event: Event) => {
      event.preventDefault()
    }
    button.addEventListener('touchstart', preventTouchDefault, { passive: false })
    button.addEventListener('touchmove', preventTouchDefault, { passive: false })
    button.addEventListener('touchend', preventTouchDefault, { passive: false })
    button.addEventListener('touchcancel', preventTouchDefault, { passive: false })
    button.addEventListener('dblclick', preventTouchDefault, { passive: false })
    button.addEventListener('contextmenu', preventContextMenu)
    return () => {
      button.removeEventListener('touchstart', preventTouchDefault)
      button.removeEventListener('touchmove', preventTouchDefault)
      button.removeEventListener('touchend', preventTouchDefault)
      button.removeEventListener('touchcancel', preventTouchDefault)
      button.removeEventListener('dblclick', preventTouchDefault)
      button.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [isListen])

  useEffect(() => {
    if (!showReference) {
      return
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowReference(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [showReference])

  useEffect(() => {
    if (!showSettings) {
      return
    }
    const closeSettings = () => {
      setShowSettings(false)
      settingsButtonRef.current?.blur()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const container = settingsRef.current
      if (container && !container.contains(event.target as Node)) {
        closeSettings()
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSettings()
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [showSettings])

  useEffect(() => {
    if (typeof document === 'undefined' || !showReference) {
      return
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [showReference])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showReference) {
        return
      }
      if (shouldIgnoreShortcutEvent(event)) {
        return
      }
      if (isListen) {
        if (event.code === 'Space' || event.key === ' ') {
          event.preventDefault()
          handlers.handleListenReplay()
          return
        }
        if (event.key.length !== 1) {
          return
        }
        const next = event.key.toUpperCase()
        if (!/^[A-Z0-9]$/.test(next)) {
          return
        }
        event.preventDefault()
        handlers.submitListenAnswer(next as Letter)
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'f') {
        event.preventDefault()
        handlers.handleModeChange('freestyle')
        return
      }
      if (key === 'i') {
        event.preventDefault()
        handlers.handleModeChange('listen')
        return
      }
      if (key === 'l') {
        event.preventDefault()
        handlers.handleModeChange('practice')
        return
      }
      if (event.code === 'Space' || event.key === ' ') {
        if (isPressingRef.current) {
          return
        }
        event.preventDefault()
        handlers.handleIntroPressIn()
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (isListen) {
        return
      }
      if (shouldIgnoreShortcutEvent(event)) {
        return
      }
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault()
        handlers.handlePressOut()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handlers, isListen, showReference])

  const handleShowReference = useCallback(() => {
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(true)
    trackEvent('reference_open')
  }, [])

  const handleShowAbout = useCallback(() => {
    setShowReference(false)
    setShowSettings(false)
    setShowAbout(true)
  }, [])

  const handleModeSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value
      const nextMode =
        value === 'freestyle'
          ? 'freestyle'
          : value === 'listen'
            ? 'listen'
            : 'practice'
      handlers.handleModeChange(nextMode)
      event.currentTarget.blur()
    },
    [handlers],
  )

  const handleListenWpmSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      handlers.handleListenWpmChange(Number(event.target.value))
    },
    [handlers],
  )

  const handleToneFrequencySelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      handlers.handleToneFrequencyChange(Number(event.target.value))
    },
    [handlers],
  )

  const handleShowHintToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setters.setShowHint(event.target.checked)
    },
    [setters],
  )

  const handleShowMnemonicToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setters.setShowMnemonic(event.target.checked)
    },
    [setters],
  )

  const handlePracticeWordModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handlers.handlePracticeWordModeChange(event.target.checked)
    },
    [handlers],
  )

  const handleWordModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handlers.handlePracticeWordModeChange(event.target.checked)
    },
    [handlers],
  )

  const handlePracticeAutoPlayToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setters.setPracticeAutoPlay(event.target.checked)
    },
    [setters],
  )

  const handlePracticeLearnModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handlers.handlePracticeLearnModeChange(event.target.checked)
    },
    [handlers],
  )

  const handlePracticeIfrModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handlers.handlePracticeIfrModeChange(event.target.checked)
    },
    [handlers],
  )

  const handlePracticeReviewMissesToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handlers.handlePracticeReviewMissesChange(event.target.checked)
    },
    [handlers],
  )

  const handleUseRecommended = useCallback(() => {
    handlers.handleUseRecommended()
  }, [handlers])

  const handleReplayNux = useCallback(() => {
    handlers.handleReplayNux()
  }, [handlers])

  const handleSoundCheck = useCallback(async () => {
    if (soundCheckStatus !== 'idle') {
      return
    }
    trackEvent('sound_check')
    setSoundCheckStatus('playing')
    try {
      await playMorseTone({
        code: '-',
        characterWpm: DEFAULT_CHARACTER_WPM,
        effectiveWpm: DEFAULT_CHARACTER_WPM,
        minUnitMs: LISTEN_MIN_UNIT_MS,
        frequency: toneFrequency,
      })
    } finally {
      window.setTimeout(() => setSoundCheckStatus('idle'), 600)
    }
  }, [soundCheckStatus, toneFrequency])

  const handleShowSignIn = useCallback(() => {
    setShowSignIn(true)
  }, [])

  const handleSignInWithApple = useCallback(async () => {
    await handlers.handleSignInWithApple()
  }, [handlers])

  const handleSignInWithGoogle = useCallback(async () => {
    await handlers.handleSignInWithGoogle()
  }, [handlers])

  const handleSignInWithEmail = useCallback(
    async (email: string, password: string) => {
      return handlers.handleSignInWithEmail(email, password)
    },
    [handlers],
  )

  const handleCreateAccountWithEmail = useCallback(
    async (email: string, password: string) => {
      return handlers.handleCreateAccountWithEmail(email, password)
    },
    [handlers],
  )

  const handleDeleteAccount = useCallback(() => {
    handlers.handleDeleteAccount()
  }, [handlers])

  const handleSignOut = useCallback(() => {
    void firebaseSignOut(getAuth())
  }, [])

  const todayContribution = useMemo(
    () => todayStreakContribution({ dailyActivity, streak }),
    [dailyActivity, streak],
  )

  const handlePlayReferenceCharacter = useCallback(
    (char: Letter) => {
      void playMorseTone({
        code: MORSE_DATA[char].code,
        characterWpm: REFERENCE_WPM,
        effectiveWpm: REFERENCE_WPM,
        minUnitMs: LISTEN_MIN_UNIT_MS,
        frequency: toneFrequency,
      })
    },
    [toneFrequency],
  )

  const pointerPressActiveRef = useRef(false)
  const handleButtonPointerDown = useCallback(() => {
    if (pointerPressActiveRef.current) {
      return
    }
    pointerPressActiveRef.current = true
    handlers.handleIntroPressIn()
  }, [handlers])

  const handleButtonPointerEnd = useCallback(() => {
    if (!pointerPressActiveRef.current) {
      return
    }
    pointerPressActiveRef.current = false
    handlers.handlePressOut()
  }, [handlers])

  const handleButtonKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.repeat) {
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (!pointerPressActiveRef.current) {
          pointerPressActiveRef.current = true
          handlers.handleIntroPressIn()
        }
      }
    },
    [handlers],
  )

  const handleButtonKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleButtonPointerEnd()
      }
    },
    [handleButtonPointerEnd],
  )

  const listenDisplayClass = `letter ${letterPlaceholder ? 'letter-placeholder' : ''}`
  const stageTarget = isFreestyle || isListen ? '' : MORSE_DATA[stageLetter as Letter]?.code ?? ''
  const pipsNode = useMemo(
    () =>
      derived.stagePips.map((pip, index) => (
        <span
          key={`${pip.type}-${index}`}
          className={`pip ${pip.type === 'dot' ? 'dot' : 'dah'} ${
            pip.state === 'hit' ? 'hit' : 'expected'
          }`}
        />
      )),
    [derived.stagePips],
  )

  const freestyleDisplay = isFreestyle ? (stageLetter as string) : ''
  const hasFreestyleDisplay = isFreestyle && Boolean(freestyleDisplay)
  const practiceLetter = (isFreestyle || isListen ? 'A' : stageLetter) as Letter

  const listenDisplay = isListen ? (stageLetter as string) : '?'
  const freestyleStatusText = isFreestyle ? statusText : ''
  const listenStatusText = isListen ? statusText : ''
  const practiceStatusText = !isFreestyle && !isListen ? statusText : ''

  const userLabel = user
    ? (user.displayName ?? user.email ?? 'Signed in')
    : ''
  const userInitial = user ? (userLabel ? userLabel[0].toUpperCase() : '?') : ''
  const authReady = true

  const nuxMorseButton = (
    <MorseButton
      buttonRef={morseButtonRef}
      isPressing={isPressing}
      onPointerDown={handleButtonPointerDown}
      onPointerUp={handleButtonPointerEnd}
      onPointerCancel={handleButtonPointerEnd}
      onPointerLeave={handleButtonPointerEnd}
      onKeyDown={handleButtonKeyDown}
      onKeyUp={handleButtonKeyUp}
      onBlur={handleButtonPointerEnd}
    />
  )

  return (
    <div
      className={`app status-idle mode-${mode}${
        isListen && useCustomKeyboard ? ' listen-focused' : ''
      }${isNuxActive ? ' nux-active' : ''}`}
    >
      <header className="top-bar">
        <div className="logo">
          <button
            type="button"
            className="logo-button"
            onClick={handleShowReference}
            aria-label="Open reference chart"
            aria-haspopup="dialog"
            aria-expanded={showReference}
          >
            <img src="/Dit-logo.svg" alt="Dit" />
          </button>
        </div>
        <select
          className="mode-select"
          value={mode}
          onChange={handleModeSelectChange}
          aria-label="Mode"
        >
          <option value="practice">Practice</option>
          <option value="freestyle">Freestyle</option>
          <option value="listen">Listen</option>
        </select>
        <div className="settings" ref={settingsRef}>
          <button
            ref={settingsButtonRef}
            type="button"
            className="settings-button"
            onClick={() => setShowSettings((prev) => !prev)}
            aria-expanded={showSettings}
            aria-controls="settings-panel"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.86a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.07.63-.07.94s.02.63.07.94L2.71 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.56Zm-7.14 2.56a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
                fill="currentColor"
              />
            </svg>
          </button>
          {showSettings ? (
            <SettingsPanel
              showHint={showHint}
              onShowHintChange={handleShowHintToggle}
              showMnemonic={showMnemonic}
              onShowMnemonicChange={handleShowMnemonicToggle}
              isFreestyle={isFreestyle}
              isListen={isListen}
              onShowLearning={() => setShowLearning(true)}
              practiceWordMode={practiceWordMode}
              onPracticeWordModeChange={handlePracticeWordModeToggle}
              listenWpm={listenWpm}
              listenWpmMin={LISTEN_WPM_MIN}
              listenWpmMax={LISTEN_WPM_MAX}
              onShowAbout={handleShowAbout}
              onListenWpmChange={handleListenWpmSelectChange}
              toneFrequency={toneFrequency}
              toneFrequencyMin={TONE_FREQUENCY_RANGE.min}
              toneFrequencyMax={TONE_FREQUENCY_RANGE.max}
              toneFrequencyStep={TONE_FREQUENCY_RANGE.step}
              onToneFrequencyChange={handleToneFrequencySelectChange}
              freestyleWordMode={freestyleWordMode}
              onWordModeChange={handleWordModeToggle}
              onSoundCheck={handleSoundCheck}
              soundCheckStatus={soundCheckStatus}
              user={user}
              userLabel={userLabel}
              userInitial={userInitial}
              authReady={authReady}
              onShowSignIn={handleShowSignIn}
              onDeleteAccount={handleDeleteAccount}
              isDeletingAccount={isDeletingAccount}
              onSignOut={handleSignOut}
              practiceAutoPlay={practiceAutoPlay}
              practiceLearnMode={practiceLearnMode}
              practiceIfrMode={practiceIfrMode}
              practiceReviewMisses={practiceReviewMisses}
              guidedCourseActive={guidedCourseActive}
              onPracticeAutoPlayChange={handlePracticeAutoPlayToggle}
              onPracticeLearnModeChange={handlePracticeLearnModeToggle}
              onPracticeIfrModeChange={handlePracticeIfrModeToggle}
              onPracticeReviewMissesChange={handlePracticeReviewMissesToggle}
              onUseRecommended={handleUseRecommended}
              onReplayNux={import.meta.env.DEV ? handleReplayNux : undefined}
            />
          ) : null}
        </div>
      </header>
      <StageDisplay
        freestyleDisplay={freestyleDisplay}
        hasFreestyleDisplay={hasFreestyleDisplay}
        hintVisible={hintVisible}
        isFreestyle={isFreestyle}
        isListen={isListen}
        letter={practiceLetter}
        letterPlaceholder={letterPlaceholder}
        listenDisplay={listenDisplay}
        listenDisplayClass={listenDisplayClass}
        listenStatus={listenStatus}
        listenStatusText={listenStatusText}
        listenTtrText={listenTtrText}
        listenWavePlayback={state.listenWavePlayback}
        pips={pipsNode}
        practiceWord={practiceWord}
        practiceWordIndex={practiceWordIndex}
        practiceWordMode={practiceWordMode}
        practiceWpmText={practiceWpmText}
        statusText={practiceStatusText}
        target={stageTarget}
      />
      <div className="controls">
        {derived.isGuidedLessonModeMismatch ? (
          <button
            type="button"
            className="return-to-lesson-button"
            onClick={() =>
              handlers.moveIntoGuidedLesson(
                state.guidedPhase,
                state.guidedPackIndex,
                state.guidedProgress,
              )
            }
            aria-label="Return to guided lesson"
          >
            Return to lesson
          </button>
        ) : null}
        {isFreestyle ? (
          <>
            <div className="freestyle-status" aria-live="polite">
              {freestyleStatusText}
            </div>
            <button
              type="button"
              className="hint-button submit-button"
              onClick={handlers.handleFreestyleClear}
            >
              Clear
            </button>
          </>
        ) : null}
        {isListen ? (
          <ListenControls
            listenStatus={listenStatus}
            onReplay={handlers.handleListenReplay}
            onSubmitAnswer={handlers.submitListenAnswer}
            useCustomKeyboard={useCustomKeyboard}
          />
        ) : (
          <MorseButton
            buttonRef={morseButtonRef}
            isPressing={isPressing}
            onPointerDown={handleButtonPointerDown}
            onPointerUp={handleButtonPointerEnd}
            onPointerCancel={handleButtonPointerEnd}
            onPointerLeave={handleButtonPointerEnd}
            onKeyDown={handleButtonKeyDown}
            onKeyUp={handleButtonKeyUp}
            onBlur={handleButtonPointerEnd}
          />
        )}
      </div>
      {showReference ? (
        <ReferenceModal
          letters={[...REFERENCE_LETTERS]}
          morseData={MORSE_DATA}
          numbers={[...REFERENCE_NUMBERS]}
          onClose={() => setShowReference(false)}
          onResetScores={handlers.handleResetScores}
          scores={scores}
          hero={computeHero({
            learnerProfile: learnerProfile ?? undefined,
            scores,
            letterAccuracy,
            bestWpm,
          })}
          streak={streak}
          todayCorrect={todayContribution.correct}
          streakAtRisk={todayContribution.atRisk}
          letterAccuracy={letterAccuracy}
          onPlayCharacter={handlePlayReferenceCharacter}
          courseProgress={
            guidedCourseActive
              ? {
                  packIndex: guidedPackIndex,
                  totalPacks: BEGINNER_COURSE_PACKS.length,
                  phase: guidedPhase,
                  packLetters: guidedCurrentPack,
                }
              : null
          }
        />
      ) : null}
      {showLearning ? (
        <LearningSheet
          guidedCourseActive={guidedCourseActive}
          guidedPackIndex={guidedPackIndex}
          guidedMaxPackReached={guidedMaxPackReached}
          maxLevel={state.maxLevel}
          customLetters={customLetters}
          onClose={() => setShowLearning(false)}
          onSelectPack={(packIndex) => {
            handlers.moveIntoGuidedLesson('teach', packIndex, createGuidedLessonProgress())
          }}
          onSelectTier={(level) => {
            // Order matters: handleSetGuidedCourseActive(false) must run first so
            // handleMaxLevelChange's guidedCourseActiveRef guard doesn't no-op the level change.
            handlers.handleSetGuidedCourseActive(false)
            handlers.handleSelectCustomLetters([])
            handlers.handleMaxLevelChange(level)
          }}
          onSelectCustomLetters={(letters) => {
            handlers.handleSetGuidedCourseActive(false)
            handlers.handleSelectCustomLetters(letters)
          }}
          onSetGuidedCourseActive={handlers.handleSetGuidedCourseActive}
        />
      ) : null}
      {showSignIn ? (
        <SignInSheet
          onClose={() => setShowSignIn(false)}
          onSignInWithApple={handleSignInWithApple}
          onSignInWithGoogle={handleSignInWithGoogle}
          onSignInWithEmail={handleSignInWithEmail}
          onCreateAccountWithEmail={handleCreateAccountWithEmail}
        />
      ) : null}
      {phaseModal ? (
        <PhaseModal
          content={phaseModal}
          onDismiss={handlePhaseModalDismiss}
        />
      ) : null}
      {isNuxActive ? (
        <NuxModal
          step={onboarding.nuxStep}
          learnerProfile={state.learnerProfile}
          soundChecked={state.didCompleteSoundCheck}
          tutorialTapCount={state.tutorialTapCount}
          tutorialHoldCount={state.tutorialHoldCount}
          currentPack={BEGINNER_COURSE_PACKS[0] ?? []}
          morseButton={nuxMorseButton}
          onWelcomeDone={handlers.handleNuxWelcomeDone}
          onChooseProfile={handlers.handleNuxChooseProfile}
          onPlaySoundCheck={handlers.handleNuxPlaySoundCheck}
          onContinueFromSoundCheck={handlers.handleNuxContinueFromSoundCheck}
          onCompleteButtonTutorial={handlers.handleNuxCompleteButtonTutorial}
          onFinishKnownTour={handlers.handleFinishKnownTour}
          onContinueFromStages={handlers.handleNuxContinueFromStages}
          onStartBeginnerCourse={handlers.handleStartBeginnerCourse}
          onSkipReminder={handlers.handleNuxSkipReminder}
        />
      ) : null}
      {showAbout ? (
        <div
          className="about-overlay"
          role="presentation"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="about-card"
            role="dialog"
            aria-modal="true"
            aria-label="About Dit"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="about-title">Dit</p>
            <p className="about-instruction">
              Tap that big button. Quick taps make dots, longer presses make
              dashes.
            </p>
            <p className="about-instruction about-instruction-secondary">
              Use <strong>settings</strong> to adjust difficulty, enable hints,
              and sign in to save your progress. Tap the logo for the reference
              chart.
            </p>
            <p className="about-instruction about-instruction-secondary">
              <strong>Modes:</strong> Practice for guided learning, Freestyle to
              translate on your own, or Listen to test your copy skills.
            </p>
            <Footer />
            <button
              type="button"
              className="about-close"
              onClick={() => setShowAbout(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Routes between the main app and legal pages. */
function App() {
  if (typeof window === 'undefined') {
    return <MainApp />
  }
  const trimmedPath = window.location.pathname.replace(/\/+$/, '')
  const path = trimmedPath === '' ? '/' : trimmedPath
  if (path === '/privacy') {
    return <PrivacyPolicy />
  }
  if (path === '/terms') {
    return <TermsOfService />
  }
  if (path === '/support') {
    return <SupportPage />
  }
  if (path === '/') {
    return <MainApp />
  }
  return <Page404 />
}

export default App
