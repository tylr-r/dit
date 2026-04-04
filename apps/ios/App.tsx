import { BEGINNER_COURSE_PACKS, MORSE_DATA } from '@dit/core'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { AboutModal } from './src/components/AboutModal'
import { BackgroundGlow } from './src/components/BackgroundGlow'
import { DitButton } from './src/components/DitButton'
import { ListenControls } from './src/components/ListenControls'
import { MorseButton } from './src/components/MorseButton'
import { MorseLiquidSurface } from './src/components/MorseLiquidSurface'
import { NuxModal } from './src/components/NuxModal'
import { PhaseModal } from './src/components/PhaseModal'
import { ReferenceModalSheet } from './src/components/ReferenceModalSheet'
import { SettingsModal } from './src/components/SettingsModal'
import { StageDisplay } from './src/components/StageDisplay'
import { TopBar } from './src/components/TopBar'
import { useAuth } from './src/hooks/useAuth'
import { useBackgroundIdle } from './src/hooks/useBackgroundIdle'
import { useMorseSessionController } from './src/hooks/useMorseSessionController'
import { useOnboardingState } from './src/hooks/useOnboardingState'
import { usePhaseModalState } from './src/hooks/usePhaseModalState'
import { useSystemLowPowerMode } from './src/hooks/useSystemLowPowerMode'
import { signOut } from './src/services/auth'
import {
  LEVELS,
  LISTEN_MIN_UNIT_MS,
  LISTEN_WPM_MAX,
  LISTEN_WPM_MIN,
  REFERENCE_LETTERS,
  REFERENCE_NUMBERS,
  REFERENCE_WPM,
} from './src/utils/appState'
import { playMorseTone } from './src/utils/tone'

/** Primary app entry for Dit iOS. */
export default function App() {
  const { user } = useAuth()
  const { phaseModal, showPhaseModal, handlePhaseModalDismiss } = usePhaseModalState()
  const onboarding = useOnboardingState()
  const isSystemLowPowerModeEnabled = useSystemLowPowerMode()
  const { isBackgroundIdle, handleRootTouchStart } = useBackgroundIdle()
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showReference, setShowReference] = useState(false)

  const session = useMorseSessionController({
    user,
    isDeletingAccount,
    setIsDeletingAccount,
    showReference,
    setShowSettings,
    setShowAbout,
    setShowReference,
    showPhaseModal,
    onboarding,
  })

  const { state, setters, derived, handlers } = session
  const isNuxActive = onboarding.nuxReady && onboarding.nuxStatus === 'pending'
  const isBackgroundAnimationPaused =
    !isNuxActive && (isSystemLowPowerModeEnabled || isBackgroundIdle)

  const handleShowReference = useCallback(() => {
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(true)
  }, [])

  const handleShowAbout = useCallback(() => {
    setShowReference(false)
    setShowAbout(true)
  }, [])

  const handleSettingsToggle = useCallback(() => {
    setShowAbout(false)
    setShowReference(false)
    onboarding.dismissSettingsHint()
    setShowSettings((prev) => !prev)
  }, [onboarding])

  return (
    <SafeAreaProvider>
      <View style={styles.container} onStartShouldSetResponderCapture={handleRootTouchStart}>
        <MorseLiquidSurface
          paused={isBackgroundAnimationPaused}
          targetFps={20}
          speedMultiplier={0.35}
          style={styles.liquidBackground}
        />
        <BackgroundGlow />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {!isNuxActive ? (
            <TopBar
              mode={state.mode}
              onModeChange={handlers.handleModeChange}
              onPressReference={handleShowReference}
              onSettingsPress={handleSettingsToggle}
              showSettingsHint={derived.showSettingsHint}
              courseChipText={state.guidedCourseActive ? `Pack ${state.guidedPackIndex + 1}` : null}
            />
          ) : null}
          {showAbout ? <AboutModal onClose={() => setShowAbout(false)} /> : null}
          {showSettings ? (
            <SettingsModal
              isFreestyle={derived.isFreestyle}
              isListen={derived.isListen}
              levels={LEVELS}
              maxLevel={state.maxLevel}
              practiceWordMode={derived.isFreestyle ? state.freestyleWordMode : state.practiceWordMode}
              practiceAutoPlay={state.practiceAutoPlay}
              practiceLearnMode={state.practiceLearnMode}
              practiceIfrMode={state.practiceIfrMode}
              practiceReviewMisses={state.practiceReviewMisses}
              guidedCourseActive={state.guidedCourseActive}
              listenCharacterWpm={state.listenWpm}
              listenCharacterWpmMin={LISTEN_WPM_MIN}
              listenCharacterWpmMax={LISTEN_WPM_MAX}
              showHint={state.showHint}
              showMnemonic={state.showMnemonic}
              isDeletingAccount={isDeletingAccount}
              onClose={() => setShowSettings(false)}
              onMaxLevelChange={handlers.handleMaxLevelChange}
              onPracticeWordModeChange={handlers.handlePracticeWordModeChange}
              onPracticeAutoPlayChange={setters.setPracticeAutoPlay}
              onPracticeLearnModeChange={handlers.handlePracticeLearnModeChange}
              onPracticeIfrModeChange={handlers.handlePracticeIfrModeChange}
              onPracticeReviewMissesChange={handlers.handlePracticeReviewMissesChange}
              onListenCharacterWpmChange={handlers.handleListenWpmChange}
              onShowHintChange={setters.setShowHint}
              onShowMnemonicChange={setters.setShowMnemonic}
              onUseRecommended={handlers.handleUseRecommended}
              onShowAbout={handleShowAbout}
              user={user}
              onSignInWithApple={handlers.handleSignInWithApple}
              onSignInWithGoogle={handlers.handleSignInWithGoogle}
              onSignOut={signOut}
              onDeleteAccount={handlers.handleDeleteAccount}
              onReplayNux={handlers.handleReplayNux}
            />
          ) : null}
          {showReference ? (
            <ReferenceModalSheet
              letters={REFERENCE_LETTERS}
              numbers={REFERENCE_NUMBERS}
              morseData={MORSE_DATA}
              scores={state.scores}
              courseProgress={
                state.guidedCourseActive
                  ? {
                      packIndex: state.guidedPackIndex,
                      totalPacks: BEGINNER_COURSE_PACKS.length,
                      phase: state.guidedPhase,
                      packLetters: derived.guidedCurrentPack,
                    }
                  : null
              }
              onClose={() => setShowReference(false)}
              onResetScores={handlers.handleResetScores}
              onPlaySound={(char) => {
                void playMorseTone({
                  code: MORSE_DATA[char].code,
                  characterWpm: REFERENCE_WPM,
                  effectiveWpm: REFERENCE_WPM,
                  minUnitMs: LISTEN_MIN_UNIT_MS,
                })
              }}
            />
          ) : null}
          {!isNuxActive ? (
            <StageDisplay
              letter={derived.stageLetter}
              statusText={derived.statusText}
              statusDetailText={!derived.isListen ? derived.guidedPracticeStatusDetailText : null}
              statusDetailTokens={derived.isListen ? derived.listenStatusDetailTokens : null}
              pips={derived.stagePips}
              hintVisible={derived.hintVisible}
              letterPlaceholder={derived.letterPlaceholder}
              isListen={derived.isListen}
              listenStatus={state.listenStatus}
              listenWavePlayback={state.listenWavePlayback}
              freestyleToneActive={state.isPressing}
              practiceWpmText={derived.practiceWpmText}
              listenTtrText={derived.listenTtrText}
              practiceWordMode={derived.showPracticeWord}
              practiceWord={derived.showPracticeWord ? derived.practiceWord : null}
              practiceWordIndex={state.practiceWordIndex}
              isFreestyle={derived.isFreestyle}
            />
          ) : null}
          {!isNuxActive ? (
            <View style={styles.controls}>
              {derived.isGuidedLessonModeMismatch ? (
                <DitButton
                  onPress={() => {
                    handlers.moveIntoGuidedLesson(
                      state.guidedPhase,
                      state.guidedPackIndex,
                      state.guidedProgress,
                    )
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Return to guided lesson"
                  style={{ marginBottom: 12 }}
                  textStyle={{ fontSize: 14 }}
                  radius={24}
                  paddingHorizontal={16}
                  paddingVertical={10}
                  text="Return to lesson"
                />
              ) : null}
              {derived.isListen ? (
                <ListenControls
                  availableLetters={derived.activeLetters}
                  listenStatus={state.listenStatus}
                  onReplay={handlers.handleListenReplay}
                  onSubmitAnswer={handlers.submitListenAnswer}
                />
              ) : (
                <>
                  {derived.isFreestyle ? (
                    <DitButton
                      onPress={handlers.handleFreestyleClear}
                      accessibilityRole="button"
                      accessibilityLabel="Clear freestyle word"
                      style={{ marginBottom: 12 }}
                      textStyle={{ fontSize: 14 }}
                      radius={24}
                      paddingHorizontal={12}
                      paddingVertical={8}
                      text="Clear"
                    />
                  ) : null}
                  {!derived.isFreestyle ? (
                    <DitButton
                      onPress={handlers.handlePracticeReplay}
                      accessibilityRole="button"
                      accessibilityLabel="Play target character"
                      style={styles.practicePlayButton}
                      textStyle={styles.practicePlayButtonText}
                      radius={24}
                      paddingHorizontal={18}
                      paddingVertical={8}
                      text="Play"
                    />
                  ) : null}
                  <View style={styles.morseButtonWrap}>
                    {derived.showMorseHint ? (
                      <View style={styles.morseHint}>
                        <Text style={styles.hintText}>
                          Tap the big Morse key to make a dit (short press) or dah (long press).
                        </Text>
                        <View style={styles.morseHintArrow} />
                      </View>
                    ) : null}
                    <MorseButton
                      disabled={derived.isMorseDisabled}
                      isPressing={state.isPressing}
                      onPressIn={handlers.handleIntroPressIn}
                      onPressOut={handlers.handlePressOut}
                    />
                  </View>
                </>
              )}
            </View>
          ) : onboarding.nuxStep === 'button_tutorial' ? (
            <View style={styles.nuxExerciseControls}>
              <MorseButton
                disabled={derived.isMorseDisabled}
                isPressing={state.isPressing}
                onPressIn={handlers.handleIntroPressIn}
                onPressOut={handlers.handlePressOut}
                showTapHint={!state.didCompleteTutorialTap && !state.didCompleteTutorialHold}
              />
            </View>
          ) : null}
        </SafeAreaView>
        {phaseModal ? (
          <PhaseModal content={phaseModal} onDismiss={handlePhaseModalDismiss} />
        ) : null}
        {isNuxActive ? (
          <NuxModal
            step={onboarding.nuxStep}
            learnerProfile={state.learnerProfile}
            soundChecked={state.didCompleteSoundCheck}
            didCompleteTutorialTap={state.didCompleteTutorialTap}
            didCompleteTutorialHold={state.didCompleteTutorialHold}
            currentPack={BEGINNER_COURSE_PACKS[0] ?? []}
            onChooseProfile={handlers.handleNuxChooseProfile}
            onPlaySoundCheck={handlers.handleNuxPlaySoundCheck}
            onContinueFromSoundCheck={handlers.handleNuxContinueFromSoundCheck}
            onPlayDitDemo={handlers.handleNuxPlayDitDemo}
            onPlayDahDemo={handlers.handleNuxPlayDahDemo}
            onCompleteButtonTutorial={handlers.handleNuxCompleteButtonTutorial}
            onFinishKnownTour={handlers.handleFinishKnownTour}
            onStartBeginnerCourse={handlers.handleStartBeginnerCourse}
          />
        ) : null}
      </View>
      <StatusBar style="light" />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0c12',
    overflow: 'hidden',
  },
  liquidBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  controls: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  morseButtonWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  practicePlayButton: {
    marginBottom: 16,
  },
  practicePlayButtonText: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  morseHint: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'hsla(210, 33%, 14%, 0.90)',
    alignItems: 'center',
    gap: 12,
  },
  morseHintArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    width: 12,
    height: 12,
    backgroundColor: 'hsla(210, 33%, 14%, 0.90)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ translateX: -6 }, { rotate: '45deg' }],
  },
  hintText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(244, 247, 249, 0.9)',
  },
  nuxExerciseControls: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
})
