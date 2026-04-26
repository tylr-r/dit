import { MaterialIcons } from '@expo/vector-icons'
import { DatePicker, Host } from '@expo/ui/swift-ui'
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers'
import { SymbolView } from 'expo-symbols'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Reanimated, {
  Easing as REasing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { normalizeColorForNative } from '../design/color'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'
import DitLogo from './DitLogo'
import { LetterDealChip } from './nux/LetterDealChip'
import { MorphGhost, type MorphRect } from './nux/MorphGhost'
import { SonarRipple } from './nux/SonarRipple'
import { SignInSheet } from './SignInSheet'
import { StageCard } from './nux/StageCard'
import { StageConnector } from './nux/StageConnector'
import {
  BEZIER,
  CTA_SLOT_HEIGHT,
  EASE,
  TIMING,
} from './nux/animationTokens'
import { useReduceMotion } from './nux/useReduceMotion'

type NuxStep =
  | 'welcome'
  | 'profile'
  | 'sound_check'
  | 'button_tutorial'
  | 'known_tour'
  | 'beginner_stages'
  | 'beginner_intro'
  | 'reminder'

type NuxModalProps = {
  step: NuxStep
  learnerProfile: 'beginner' | 'known' | null
  soundChecked: boolean
  tutorialTapCount: number
  tutorialHoldCount: number
  currentPack: string[]
  /** Current Firebase user, if any. When null the welcome screen shows sign-in options. */
  user: { uid: string } | null
  onWelcomeDone: () => void
  onChooseProfile: (profile: 'beginner' | 'known') => void
  onPlaySoundCheck: () => void
  onContinueFromSoundCheck: () => void
  onCompleteButtonTutorial: () => void
  onFinishKnownTour: () => void
  onContinueFromStages: () => void
  onStartBeginnerCourse: () => void
  onSetReminder: (time: string) => void
  onSkipReminder: () => void
  onSignInWithApple: () => void
  onSignInWithGoogle: () => void
  onSignInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onCreateAccountWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  /** Fires when the user taps "Stay signed out" from the welcome options. */
  onStaySignedOut: () => void
}

// ─── Step body transition ─────────────────────────────────────────────────────
// Pure opacity crossfade. Content swap is deferred until opacity hits zero so
// there's no visible handoff; no spatial slide to avoid mid-transition position
// glitches from the worklet/JS state-swap gap.

function useStepTransition(step: NuxStep, reduceMotion: boolean) {
  const [displayedStep, setDisplayedStep] = useState<NuxStep>(step)
  const opacity = useSharedValue(1)
  const prevStep = useRef(step)

  useEffect(() => {
    if (prevStep.current === step) return
    prevStep.current = step

    const exitDuration = reduceMotion ? 140 : TIMING.exit
    opacity.value = withTiming(
      0,
      { duration: exitDuration, easing: REasing.bezier(...BEZIER.out) },
      (finished) => {
        'worklet'
        if (!finished) return
        runOnJS(setDisplayedStep)(step)
      },
    )
  }, [step, reduceMotion, opacity])

  // Fade back in once displayedStep has caught up to the new step. Running the
  // enter animation off the committed state (rather than chaining it inside the
  // exit callback) guarantees the new content is mounted before we ramp opacity.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    opacity.value = withTiming(1, {
      duration: reduceMotion ? 200 : TIMING.medium,
      easing: REasing.bezier(...BEZIER.out),
    })
  }, [displayedStep, reduceMotion, opacity])

  const bodyAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return { displayedStep, bodyAnimStyle }
}

// ─── Stagger entrance ─────────────────────────────────────────────────────────
// Each element in a step staggers in with a subtle translateY + fade.

function useStaggerEntrance(
  count: number,
  trigger: string,
  options?: { stepDelay?: number; duration?: number; startY?: number },
) {
  const { stepDelay = 50, duration = 340, startY = 8 } = options ?? {}
  const anims = useRef<Animated.Value[]>([])
  const yAnims = useRef<Animated.Value[]>([])
  const prevTrigger = useRef(trigger)

  if (anims.current.length !== count) {
    anims.current = Array.from({ length: count }, () => new Animated.Value(0))
    yAnims.current = Array.from({ length: count }, () => new Animated.Value(startY))
  }

  // Reset values during render (before children mount with the new trigger) so
  // new content never paints a frame at previous-completion values. Resetting
  // in useEffect instead creates a one-frame flash while the parent fade is
  // already ramping back up.
  if (prevTrigger.current !== trigger) {
    prevTrigger.current = trigger
    anims.current.forEach((a) => a.setValue(0))
    yAnims.current.forEach((a) => a.setValue(startY))
  }

  useEffect(() => {
    const animations = anims.current.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          delay: i * stepDelay,
          easing: EASE.out,
          useNativeDriver: true,
        }),
        Animated.timing(yAnims.current[i], {
          toValue: 0,
          duration,
          delay: i * stepDelay,
          easing: EASE.out,
          useNativeDriver: true,
        }),
      ]),
    )

    Animated.stagger(0, animations).start()
  }, [trigger, stepDelay, duration, startY])

  return useMemo(
    () =>
      anims.current.map((opacity, i) => ({
        opacity,
        transform: [{ translateY: yAnims.current[i] }],
        overflow: 'visible' as const,
      })),
    [trigger, count],
  )
}

// ─── Progress dots ────────────────────────────────────────────────────────────
// Animated width + color transitions so dots feel alive without moving position.

const progressIndexByStep: Record<NuxStep, number> = {
  welcome: -1,
  profile: 0,
  sound_check: 1,
  button_tutorial: 2,
  known_tour: 3,
  beginner_stages: 3,
  beginner_intro: 3,
  reminder: 4,
}

function AnimatedDot({ isDone, isActive }: { isDone: boolean; isActive: boolean }) {
  const widthAnim = useRef(new Animated.Value(isActive ? 20 : 7)).current
  const colorAnim = useRef(new Animated.Value(isDone ? 1 : isActive ? 0.5 : 0)).current

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: isActive ? 20 : 7,
      tension: 300,
      friction: 22,
      useNativeDriver: false,
    }).start()

    Animated.timing(colorAnim, {
      toValue: isDone ? 1 : isActive ? 0.5 : 0,
      duration: 250,
      easing: EASE.inOut,
      useNativeDriver: false,
    }).start()
  }, [isActive, isDone, widthAnim, colorAnim])

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [colors.text.primary20, colors.text.primary, colors.feedback.success],
  })

  return <Animated.View style={[styles.progressDot, { width: widthAnim, backgroundColor }]} />
}

function ProgressDots({ step }: { step: NuxStep }) {
  const total = 5
  const activeIndex = progressIndexByStep[step]

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, index) => (
        <AnimatedDot key={index} isDone={index < activeIndex} isActive={index === activeIndex} />
      ))}
    </View>
  )
}

// ─── Tutorial progress dots ──────────────────────────────────────────────────
// Shows N small dots that fill with a pop as each rep completes.

function TutorialProgressDot({ filled }: { filled: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const fillAnim = useRef(new Animated.Value(filled ? 1 : 0)).current
  const prevFilled = useRef(filled)

  useEffect(() => {
    if (filled && !prevFilled.current) {
      scaleAnim.setValue(0.4)
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 400,
        friction: 12,
        useNativeDriver: true,
      }).start()

      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 200,
        easing: EASE.out,
        useNativeDriver: false,
      }).start()
    }
    prevFilled.current = filled
  }, [filled, scaleAnim, fillAnim])

  const backgroundColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.feedback.success],
  })
  const borderColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text.primary20, colors.feedback.success],
  })

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Animated.View style={[styles.progressPip, { backgroundColor, borderColor }]} />
    </Animated.View>
  )
}

function TutorialProgress({ count, required }: { count: number; required: number }) {
  return (
    <View style={styles.progressPips}>
      {Array.from({ length: required }).map((_, i) => (
        <TutorialProgressDot key={i} filled={i < count} />
      ))}
    </View>
  )
}

// ─── Welcome screen entrance ──────────────────────────────────────────────────

// Signed-out users see two explicit options (Sign in / Stay signed out) that
// fade in once the splash composition has settled. The pause lets the welcome
// read as a beat of its own before asking for input.
const WELCOME_OPTIONS_DELAY_MS = 2000
const WELCOME_OPTIONS_FADE_MS = 600

function WelcomeScreen({
  onWelcomeDone,
  reduceMotion,
  user,
  onRequestSignIn,
  onStaySignedOut,
}: {
  onWelcomeDone: () => void
  reduceMotion: boolean
  user: { uid: string } | null
  onRequestSignIn: () => void
  onStaySignedOut: () => void
}) {
  // This screen IS the splash. Every element is rendered at its resting state
  // on first paint so the native splash (bg color only) cross-fades directly
  // into a complete composition. The breathing loop is the only animation.
  const logoScale = useSharedValue(1)
  useEffect(() => {
    if (reduceMotion) return
    logoScale.value = withRepeat(
      withTiming(1.015, {
        duration: TIMING.breath,
        easing: REasing.bezier(...BEZIER.inOut),
      }),
      -1,
      true,
    )
    return () => {
      cancelAnimation(logoScale)
    }
  }, [logoScale, reduceMotion])

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }))

  // Signed-in users (NUX replay) keep the single tap-anywhere advance; we
  // hide the options entirely so the replay doesn't ask them to re-authenticate.
  const showOptions = user === null
  const [optionsVisible, setOptionsVisible] = useState(false)
  const optionsOpacity = useSharedValue(0)

  useEffect(() => {
    if (!showOptions) return
    const timer = setTimeout(() => setOptionsVisible(true), WELCOME_OPTIONS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [showOptions])

  useEffect(() => {
    if (!optionsVisible) return
    optionsOpacity.value = withTiming(1, {
      duration: reduceMotion ? 0 : WELCOME_OPTIONS_FADE_MS,
      easing: REasing.bezier(...BEZIER.out),
    })
  }, [optionsOpacity, optionsVisible, reduceMotion])

  const optionsStyle = useAnimatedStyle(() => ({
    opacity: optionsOpacity.value,
  }))

  return (
    <Pressable
      style={styles.welcomeScreen}
      onPress={showOptions ? undefined : onWelcomeDone}
      accessibilityLabel="Welcome to Dit"
    >
      <Reanimated.View style={logoStyle}>
        <DitLogo size={120} opacity={0.9} animated />
      </Reanimated.View>
      <Text style={styles.welcomeTitle}>Welcome to Dit</Text>
      {showOptions && optionsVisible ? (
        <Reanimated.View
          style={[styles.welcomeOptions, optionsStyle]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onRequestSignIn}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            hitSlop={12}
          >
            <Text style={styles.welcomePrimaryOption}>Sign in</Text>
          </Pressable>
          <Pressable
            onPress={onStaySignedOut}
            accessibilityRole="button"
            accessibilityLabel="Stay signed out"
            hitSlop={12}
          >
            <Text style={styles.welcomeSecondaryOption}>Stay signed out</Text>
          </Pressable>
        </Reanimated.View>
      ) : null}
    </Pressable>
  )
}

// ─── Tutorial instruction crossfade ───────────────────────────────────────────
// When the tutorial phase switches from tap → hold, the instruction line fades
// out, the text swaps, then it rises back in. Small directional swap keeps the
// user oriented without a disruptive full-screen change.

function TutorialInstruction({
  phase,
  reduceMotion,
}: {
  phase: 'tap' | 'hold'
  reduceMotion: boolean
}) {
  const [displayedPhase, setDisplayedPhase] = useState(phase)
  const opacity = useSharedValue(1)
  const translateY = useSharedValue(0)
  const prevPhase = useRef(phase)

  useEffect(() => {
    if (phase === prevPhase.current) return
    prevPhase.current = phase

    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: 120 }, (finished) => {
        'worklet'
        if (!finished) return
        opacity.value = withTiming(1, { duration: 200 })
      })
      setTimeout(() => setDisplayedPhase(phase), 120)
      return
    }

    opacity.value = withTiming(0, {
      duration: 160,
      easing: REasing.bezier(...BEZIER.out),
    })
    translateY.value = withTiming(-8, {
      duration: 160,
      easing: REasing.bezier(...BEZIER.out),
    })

    const swapTimer = setTimeout(() => {
      setDisplayedPhase(phase)
      translateY.value = 8
      opacity.value = withTiming(1, {
        duration: 280,
        easing: REasing.bezier(...BEZIER.out),
      })
      translateY.value = withTiming(0, {
        duration: 280,
        easing: REasing.bezier(...BEZIER.out),
      })
    }, 160)

    return () => clearTimeout(swapTimer)
  }, [phase, reduceMotion, opacity, translateY])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Reanimated.View style={animStyle}>
      <Text style={styles.tutorialInstruction}>
        {displayedPhase === 'tap' ? 'Tap 3 times on the key' : 'Now hold 3 times'}
      </Text>
    </Reanimated.View>
  )
}

// ─── Sound check icon ─────────────────────────────────────────────────────────

function SoundCheckIcon({ checked }: { checked: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const prevChecked = useRef(checked)

  useEffect(() => {
    if (checked && !prevChecked.current) {
      scaleAnim.setValue(0.6)
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start()
    }
    prevChecked.current = checked
  }, [checked, scaleAnim])

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {checked ? (
        <NuxIcon
          sfName="checkmark.circle.fill"
          materialName="check-circle"
          size={36}
          color={colors.feedback.success}
        />
      ) : (
        <NuxIcon
          sfName="speaker.wave.2.fill"
          materialName="volume-up"
          size={36}
          color={colors.text.primary}
        />
      )}
    </Animated.View>
  )
}

function NuxIcon({
  sfName,
  materialName,
  size,
  color,
}: {
  sfName: string
  materialName: string
  size: number
  color: string
}) {
  const tint = normalizeColorForNative(color)
  return (
    <View style={{ width: size, height: size }}>
      <SymbolView
        name={sfName as any}
        size={1}
        tintColor={tint}
        style={{ width: size, height: size }}
        fallback={<MaterialIcons name={materialName as any} size={size} color={tint} />}
      />
    </View>
  )
}

// ─── Pressable with scale feedback ────────────────────────────────────────────

function ScalePressable({
  onPress,
  style,
  children,
  accessibilityRole,
  accessibilityLabel,
}: {
  onPress: () => void
  style?: any
  children: React.ReactNode
  accessibilityRole?: string
  accessibilityLabel?: string
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current

  const onPressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 120,
      easing: EASE.out,
      useNativeDriver: true,
    }).start()
  }, [scaleAnim])

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start()
  }, [scaleAnim])

  // Pull flex out so the outer Pressable fills its slot in flex rows
  const flat = StyleSheet.flatten(style) || {}
  const { flex, flexGrow, flexShrink, flexBasis, alignSelf, ...innerStyle } = flat as any
  const outerFlex: any = {}
  if (flex != null) outerFlex.flex = flex
  if (flexGrow != null) outerFlex.flexGrow = flexGrow
  if (flexShrink != null) outerFlex.flexShrink = flexShrink
  if (flexBasis != null) outerFlex.flexBasis = flexBasis
  if (alignSelf != null) outerFlex.alignSelf = alignSelf

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={outerFlex}
      accessibilityRole={accessibilityRole as any}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

// ─── Profile card with subtle selected lift ───────────────────────────────────
// On selection, the card scales up a hair before the step advances.
// No glow — the room change is what confirms the choice.

function ProfileCard({
  onSelect,
  isSelected,
  accessibilityLabel,
  children,
  reduceMotion,
}: {
  onSelect: () => void
  isSelected: boolean
  accessibilityLabel?: string
  reduceMotion: boolean
  children: React.ReactNode
}) {
  const lift = useSharedValue(0)

  useEffect(() => {
    if (!isSelected) {
      lift.value = 0
      return
    }
    if (reduceMotion) {
      lift.value = 1
      return
    }
    lift.value = withTiming(1, {
      duration: 200,
      easing: REasing.bezier(...BEZIER.out),
    })
  }, [isSelected, lift, reduceMotion])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + lift.value * 0.02 }],
  }))

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Reanimated.View style={[styles.optionCard, animatedStyle]}>
        {children}
      </Reanimated.View>
    </Pressable>
  )
}

/** Full-screen first-run flow for profile selection and basic app teaching. */
export function NuxModal({
  step,
  soundChecked,
  tutorialTapCount,
  tutorialHoldCount,
  currentPack,
  user,
  onWelcomeDone,
  onChooseProfile,
  onPlaySoundCheck,
  onContinueFromSoundCheck,
  onCompleteButtonTutorial,
  onFinishKnownTour,
  onContinueFromStages,
  onStartBeginnerCourse,
  onSetReminder,
  onSkipReminder,
  onSignInWithApple,
  onSignInWithGoogle,
  onSignInWithEmail,
  onCreateAccountWithEmail,
  onStaySignedOut,
}: NuxModalProps) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const paddingTop = insets.top + spacing.xl
  const paddingBottom = insets.bottom + spacing.xl
  const isTutorial = step === 'button_tutorial'

  const reduceMotion = useReduceMotion()
  const { displayedStep, bodyAnimStyle } = useStepTransition(step, reduceMotion)
  const [profileSelection, setProfileSelection] = useState<'beginner' | 'known' | null>(
    null,
  )
  const [signInSheetVisible, setSignInSheetVisible] = useState(false)
  const handleRequestSignIn = useCallback(() => setSignInSheetVisible(true), [])
  const handleDismissSignInSheet = useCallback(() => setSignInSheetVisible(false), [])
  const handleSignInWithAppleFromSheet = useCallback(() => {
    setSignInSheetVisible(false)
    onSignInWithApple()
  }, [onSignInWithApple])
  const handleSignInWithGoogleFromSheet = useCallback(() => {
    setSignInSheetVisible(false)
    onSignInWithGoogle()
  }, [onSignInWithGoogle])
  const [reminderTime, setReminderTime] = useState('19:00')
  const reminderInitialDate = useMemo(() => {
    const now = new Date()
    now.setHours(19, 0, 0, 0)
    return now
  }, [])
  const formatClockTime = useCallback((time: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(time)
    if (!match) return time
    const hour = Number(match[1])
    const minute = Number(match[2])
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  }, [])

  const handleProfileSelect = useCallback(
    (profile: 'beginner' | 'known') => {
      if (profileSelection) return
      setProfileSelection(profile)
      const delay = reduceMotion ? 0 : 220
      setTimeout(() => onChooseProfile(profile), delay)
    },
    [profileSelection, onChooseProfile, reduceMotion],
  )

  // Sound-check ripples fire while the tone is audible. We don't have a direct
  // "tone playing" signal, so a short window approximates it — long enough to
  // feel like the rings are tracking the sound, short enough to stop soon
  // after it ends.
  const [soundRippleActive, setSoundRippleActive] = useState(false)
  const prevSoundChecked = useRef(soundChecked)

  const handlePlaySoundCheck = useCallback(() => {
    setSoundRippleActive(true)
    onPlaySoundCheck()
  }, [onPlaySoundCheck])

  useEffect(() => {
    if (!soundRippleActive) return
    const timer = setTimeout(() => setSoundRippleActive(false), 1800)
    return () => clearTimeout(timer)
  }, [soundRippleActive])

  useEffect(() => {
    if (soundChecked && !prevSoundChecked.current) {
      setSoundRippleActive(false)
    }
    prevSoundChecked.current = soundChecked
  }, [soundChecked])

  // Continue → Morse key morph. On tap we capture the Continue pill's rect,
  // spawn a ghost that tweens toward the MorseButton's known geometry, and
  // fire the step change partway through so the real key is mounted before
  // the ghost fades out.
  const ctaSlotRef = useRef<View | null>(null)
  const [morphSource, setMorphSource] = useState<MorphRect | null>(null)
  const [morphActive, setMorphActive] = useState(false)

  const morphTarget = useMemo<MorphRect>(() => {
    const w = Math.min(windowWidth - 48, 480)
    const h = 96
    return {
      x: (windowWidth - w) / 2,
      y: windowHeight - 24 - h,
      w,
      h,
      radius: 48,
    }
  }, [windowWidth, windowHeight])

  const handleContinueFromSoundCheck = useCallback(() => {
    if (morphActive) return
    if (reduceMotion) {
      onContinueFromSoundCheck()
      return
    }
    ctaSlotRef.current?.measureInWindow((x, y, w, h) => {
      if (!w || !h) {
        onContinueFromSoundCheck()
        return
      }
      setMorphSource({ x, y, w, h, radius: Math.min(h / 2, 28) })
      setMorphActive(true)
      const stepDelay = Math.round(TIMING.morph * 0.55)
      setTimeout(onContinueFromSoundCheck, stepDelay)
    })
  }, [morphActive, reduceMotion, onContinueFromSoundCheck])

  const handleMorphComplete = useCallback(() => {
    setMorphActive(false)
    setMorphSource(null)
  }, [])

  // Exit transition from the final onboarding step (reminder) into the first
  // lesson. Fades the modal out and drifts it forward a touch while the lesson
  // screen (already mounted underneath) comes into focus — avoids the abrupt
  // unmount.
  const exitProgress = useSharedValue(0)
  const exitingRef = useRef(false)
  const exitStyle = useAnimatedStyle(() => ({
    opacity: 1 - exitProgress.value,
    transform: [{ scale: 1 + exitProgress.value * 0.04 }],
  }))

  const runExitTransition = useCallback(
    (done: () => void) => {
      if (exitingRef.current) return
      exitingRef.current = true
      if (reduceMotion) {
        done()
        return
      }
      exitProgress.value = withTiming(1, {
        duration: 360,
        easing: REasing.bezier(...BEZIER.out),
      })
      setTimeout(done, 280)
    },
    [exitProgress, reduceMotion],
  )

  const handleStartBeginnerCourse = useCallback(() => {
    onStartBeginnerCourse()
  }, [onStartBeginnerCourse])

  const handleReminderSet = useCallback(() => {
    runExitTransition(() => onSetReminder(reminderTime))
  }, [onSetReminder, reminderTime, runExitTransition])

  const handleReminderSkip = useCallback(() => {
    runExitTransition(onSkipReminder)
  }, [onSkipReminder, runExitTransition])

  const handleContinueFromStages = useCallback(() => {
    onContinueFromStages()
  }, [onContinueFromStages])

  useEffect(() => {
    if (step !== 'profile') setProfileSelection(null)
  }, [step])

  // Stagger counts per step
  const staggerCounts: Record<NuxStep, number> = {
    welcome: 0,
    profile: 2,
    sound_check: 2,
    button_tutorial: 2,
    known_tour: 2,
    beginner_stages: 4,
    beginner_intro: 2,
    reminder: 2,
  }
  const staggerOptions =
    displayedStep === 'beginner_stages'
      ? { stepDelay: 650, duration: 780, startY: 22 }
      : undefined
  const stagger = useStaggerEntrance(
    staggerCounts[displayedStep],
    displayedStep,
    staggerOptions,
  )

  // Welcome no longer auto-advances. Signed-out users pick Sign in or Stay
  // signed out; signed-in users (NUX replay) tap anywhere on the splash to
  // proceed. Auto-advance would silently skip past the sign-in choice for
  // returning users on a fresh install.

  // Connectors animate inline with the card stagger so the list feels like one
  // continuous draw rather than "all cards, then all lines". Each connector's
  // internal delay lines it up with the next card's entrance.
  const stagesActive = displayedStep === 'beginner_stages'

  const TUTORIAL_REQUIRED = 3
  // Auto-advance once both tutorial inputs are completed
  useEffect(() => {
    if (step !== 'button_tutorial') return
    if (tutorialTapCount < TUTORIAL_REQUIRED || tutorialHoldCount < TUTORIAL_REQUIRED) return
    const timer = setTimeout(onCompleteButtonTutorial, 600)
    return () => clearTimeout(timer)
  }, [step, tutorialTapCount, tutorialHoldCount, onCompleteButtonTutorial])

  return (
    <Reanimated.View
      style={[styles.overlay, exitStyle]}
      pointerEvents={isTutorial ? 'box-none' : undefined}
      accessibilityViewIsModal={!isTutorial}
    >
      {displayedStep === 'welcome' ? (
        <WelcomeScreen
          onWelcomeDone={onWelcomeDone}
          reduceMotion={reduceMotion}
          user={user}
          onRequestSignIn={handleRequestSignIn}
          onStaySignedOut={onStaySignedOut}
        />
      ) : (
        <View
          style={[styles.content, { paddingTop, paddingBottom }]}
          pointerEvents={isTutorial ? 'box-none' : undefined}
        >
          {/* ProgressDots stay OUTSIDE the body transition — spatial anchor */}
          <ProgressDots step={displayedStep} />

          <Reanimated.View
            style={[styles.stepBody, bodyAnimStyle]}
            pointerEvents={isTutorial ? 'box-none' : undefined}
          >
            {displayedStep === 'profile' ? (
              <>
                <Animated.View style={[styles.copyBlock, stagger[0]]}>
                  <Text style={styles.headline}>Choose your path</Text>
                  <Text style={styles.subtext}>Pick the option that fits your experience.</Text>
                </Animated.View>
                <View style={styles.stepFill}>
                  <Animated.View style={[styles.optionColumn, stagger[1]]}>
                    <ProfileCard
                      onSelect={() => handleProfileSelect('beginner')}
                      isSelected={profileSelection === 'beginner'}
                      accessibilityLabel="Learn Morse from the basics"
                      reduceMotion={reduceMotion}
                    >
                      <View style={styles.optionHeader}>
                        <NuxIcon
                          sfName="graduationcap.fill"
                          materialName="school"
                          size={22}
                          color={colors.text.primary}
                        />
                        <Text style={styles.optionTitle}>Learn Morse</Text>
                      </View>
                      <Text style={styles.optionBody}>Start from the basics and build up.</Text>
                    </ProfileCard>
                    <ProfileCard
                      onSelect={() => handleProfileSelect('known')}
                      isSelected={profileSelection === 'known'}
                      accessibilityLabel="Quick tour for experienced users"
                      reduceMotion={reduceMotion}
                    >
                      <View style={styles.optionHeader}>
                        <NuxIcon
                          sfName="bolt.fill"
                          materialName="flash-on"
                          size={22}
                          color={colors.text.primary}
                        />
                        <Text style={styles.optionTitle}>I know Morse</Text>
                      </View>
                      <Text style={styles.optionBody}>Quick tour, then dive right in.</Text>
                    </ProfileCard>
                  </Animated.View>
                </View>
              </>
            ) : null}

            {displayedStep === 'sound_check' ? (
              <>
                <Animated.View style={[styles.copyBlock, stagger[0]]}>
                  <Text style={styles.headline}>Check your sound</Text>
                  <Text style={styles.subtext}>
                    Turn your volume up, then tap below to confirm you can hear the tones.
                  </Text>
                </Animated.View>
                <View style={styles.stepFill}>
                  <Animated.View style={stagger[1]}>
                    <ScalePressable
                      onPress={handlePlaySoundCheck}
                      style={[styles.soundButton, soundChecked && styles.soundButtonComplete]}
                      accessibilityRole="button"
                      accessibilityLabel="Test sound"
                    >
                      <SonarRipple
                        size={160}
                        color={colors.accent.wave}
                        active={soundRippleActive && !soundChecked}
                        reduceMotion={reduceMotion}
                      />
                      <SoundCheckIcon checked={soundChecked} />
                      <Text
                        style={[
                          styles.soundButtonText,
                          soundChecked && { color: colors.feedback.success, fontSize: 16 },
                        ]}
                      >
                        {soundChecked ? 'Sound works' : 'Test sound'}
                      </Text>
                    </ScalePressable>
                  </Animated.View>
                </View>
              </>
            ) : null}

            {displayedStep === 'button_tutorial' ? (
              <>
                <Animated.View style={[styles.copyBlock, stagger[0]]}>
                  <Text style={styles.headline}>Meet the Morse key</Text>
                  <Text style={styles.subtext}>
                    Try it on the key below — short taps are dits, long holds are dahs.
                  </Text>
                </Animated.View>
                <View style={styles.stepFill}>
                  <Animated.View style={[styles.tutorialBlock, stagger[1]]}>
                    <TutorialInstruction
                      phase={tutorialTapCount < TUTORIAL_REQUIRED ? 'tap' : 'hold'}
                      reduceMotion={reduceMotion}
                    />
                    <View style={styles.tutorialPipRow}>
                      <Text style={styles.tutorialPipLabel}>
                        Tap <Text style={styles.tutorialPipHint}>(dit)</Text>
                      </Text>
                      <TutorialProgress count={tutorialTapCount} required={TUTORIAL_REQUIRED} />
                    </View>
                    <View style={styles.tutorialPipRow}>
                      <Text style={styles.tutorialPipLabel}>
                        Hold <Text style={styles.tutorialPipHint}>(dah)</Text>
                      </Text>
                      <TutorialProgress count={tutorialHoldCount} required={TUTORIAL_REQUIRED} />
                    </View>
                  </Animated.View>
                </View>
              </>
            ) : null}

            {displayedStep === 'known_tour' ? (
              <>
                <Animated.View style={[styles.copyBlock, stagger[0]]}>
                  <Text style={styles.headline}>Quick app tour</Text>
                  <Text style={styles.subtext}>
                    Practice shows the target, Play replays it, the logo opens reference, and
                    Settings handles helpers, speed, and sync.
                  </Text>
                </Animated.View>
                <View style={styles.stepFill}>
                  <Animated.View style={[styles.card, stagger[1]]}>
                    <Text style={styles.bullet}>Practice: send the shown character</Text>
                    <Text style={styles.bullet}>
                      Freestyle: tap whatever you want and decode it
                    </Text>
                    <Text style={styles.bullet}>Listen: hear a letter and type the answer</Text>
                  </Animated.View>
                </View>
              </>
            ) : null}

            {displayedStep === 'beginner_stages' ? (
              <>
                <Animated.View style={[styles.copyBlock, stagger[0]]}>
                  <Text style={styles.headline}>How you'll learn</Text>
                  <Text style={styles.subtext}>
                    Each pack moves through three stages.
                  </Text>
                </Animated.View>
                <View style={styles.stagesFill}>
                  <Animated.View style={stagger[1]}>
                    <StageCard
                      number={1}
                      title="Listen"
                      description="Hear each letter and copy the sound"
                      drawDelay={780}
                      reduceMotion={reduceMotion}
                    />
                  </Animated.View>
                  <StageConnector
                    active={stagesActive}
                    delay={650}
                    reduceMotion={reduceMotion}
                  />
                  <Animated.View style={stagger[2]}>
                    <StageCard
                      number={2}
                      title="Practice"
                      description="Mix old and new letters by ear"
                      drawDelay={1430}
                      reduceMotion={reduceMotion}
                    />
                  </Animated.View>
                  <StageConnector
                    active={stagesActive}
                    delay={1300}
                    reduceMotion={reduceMotion}
                  />
                  <Animated.View style={stagger[3]}>
                    <StageCard
                      number={3}
                      title="Recall"
                      description="Hear a letter, tap the matching sound"
                      drawDelay={2080}
                      reduceMotion={reduceMotion}
                    />
                  </Animated.View>
                </View>
              </>
            ) : null}

            {displayedStep === 'beginner_intro' ? (
              <>
                <Animated.View style={[styles.copyBlock, stagger[0]]}>
                  <Text style={styles.headline}>Your first letters</Text>
                  <Text style={styles.subtext}>
                    You'll start with two letters and build from there.
                  </Text>
                </Animated.View>
                <View style={styles.stepFill}>
                  <View style={styles.packPreview}>
                    <Animated.Text style={[styles.packLabel, stagger[1]]}>
                      We'll start with
                    </Animated.Text>
                    <View style={styles.packChips}>
                      {currentPack.map((letter, i) => (
                        <LetterDealChip
                          key={letter}
                          letter={letter}
                          delay={200 + i * 120}
                          reduceMotion={reduceMotion}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </>
            ) : null}

            {displayedStep === 'reminder' ? (
              <>
                <Animated.View style={[styles.copyBlock, stagger[0]]}>
                  <Text style={styles.headline}>Daily nudge</Text>
                  <Text style={styles.subtext}>
                    Pick a time and we'll remind you to practice. Change or
                    turn it off anytime in Settings.
                  </Text>
                </Animated.View>
                <View style={styles.stepFill}>
                  <Animated.View style={[styles.reminderPickerCard, stagger[1]]}>
                    <Text style={styles.reminderTimeLabel}>
                      {formatClockTime(reminderTime)}
                    </Text>
                    <Host matchContents>
                      <DatePicker
                        selection={reminderInitialDate}
                        displayedComponents={['hourAndMinute']}
                        modifiers={[datePickerStyle('wheel')]}
                        onDateChange={(date: Date) => {
                          const hh = date.getHours().toString().padStart(2, '0')
                          const mm = date
                            .getMinutes()
                            .toString()
                            .padStart(2, '0')
                          setReminderTime(`${hh}:${mm}`)
                        }}
                      />
                    </Host>
                  </Animated.View>
                  <Pressable
                    onPress={handleReminderSkip}
                    accessibilityRole="button"
                    accessibilityLabel="Skip reminder"
                    style={({ pressed }) => [
                      styles.reminderSkip,
                      pressed && styles.reminderSkipPressed,
                    ]}
                  >
                    <Text style={styles.reminderSkipText}>Not now</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Reanimated.View>

          {/* CTA slot is always rendered with a fixed height so stepBody has
              the same available space on every step — keeps vertical centering
              consistent whether or not the step has a button. GlassView can't
              live inside the animated body (animated opacity breaks it). */}
          <View style={styles.ctaSlot}>
            {displayedStep === 'sound_check' ? (
              <View
                ref={ctaSlotRef}
                collapsable={false}
                style={morphActive ? styles.ctaSlotHidden : undefined}
              >
                <DitButton
                  text="Continue"
                  onPress={handleContinueFromSoundCheck}
                  disabled={!soundChecked}
                  style={styles.ctaButton}
                  radius={radii.pill}
                  paddingVertical={16}
                />
              </View>
            ) : null}
            {displayedStep === 'known_tour' ? (
              <DitButton
                text="Start practicing"
                onPress={onFinishKnownTour}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            ) : null}
            {displayedStep === 'beginner_stages' ? (
              <DitButton
                text="Continue"
                onPress={handleContinueFromStages}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            ) : null}
            {displayedStep === 'beginner_intro' ? (
              <DitButton
                text="Start first lesson"
                onPress={handleStartBeginnerCourse}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            ) : null}
            {displayedStep === 'reminder' ? (
              <DitButton
                text="Turn on reminder"
                onPress={handleReminderSet}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            ) : null}
          </View>
        </View>
      )}
      <MorphGhost
        source={morphSource}
        target={morphTarget}
        active={morphActive}
        onComplete={handleMorphComplete}
        reduceMotion={reduceMotion}
      />
      <SignInSheet
        visible={signInSheetVisible}
        onDismiss={handleDismissSignInSheet}
        onSignInWithApple={handleSignInWithAppleFromSheet}
        onSignInWithGoogle={handleSignInWithGoogleFromSheet}
        onSignInWithEmail={onSignInWithEmail}
        onCreateAccountWithEmail={onCreateAccountWithEmail}
      />
    </Reanimated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  welcomeScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  welcomeOptions: {
    position: 'absolute',
    bottom: 72,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
  },
  welcomePrimaryOption: {
    color: 'rgba(230, 240, 255, 0.95)',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  welcomeSecondaryOption: {
    color: 'rgba(200, 210, 220, 0.5)',
    fontSize: 13,
    letterSpacing: 0.2,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  stepBody: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  stepFill: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  progressDot: {
    height: 7,
    borderRadius: 4,
  },
  progressPips: {
    flexDirection: 'row',
    gap: 5,
  },
  progressPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  copyBlock: {
    gap: spacing.md,
    alignItems: 'center',
  },
  headline: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary40,
    textAlign: 'center',
  },
  optionColumn: {
    gap: spacing.md,
  },
  optionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.panelStrong,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  optionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary60,
  },
  soundButton: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  soundButtonComplete: {
    borderColor: colors.feedback.success,
  },
  soundButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.panelStrong,
    padding: spacing.xl,
    gap: spacing.md,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.primary90,
  },
  stagesFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packPreview: {
    alignItems: 'center',
    gap: spacing.md,
  },
  packLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.primary40,
  },
  packChips: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tutorialBlock: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  tutorialInstruction: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  tutorialPipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 120,
    justifyContent: 'space-between',
  },
  tutorialPipLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.primary40,
  },
  tutorialPipHint: {
    fontWeight: '400',
    letterSpacing: 0.4,
    color: colors.text.primary40,
  },
  ctaSlot: {
    height: CTA_SLOT_HEIGHT,
    justifyContent: 'center',
  },
  ctaSlotHidden: {
    opacity: 0,
  },
  ctaButton: {
    width: '100%' as unknown as number,
  },
  reminderPickerCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.panelStrong,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  reminderTimeLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.primary60,
  },
  reminderSkip: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reminderSkipPressed: {
    opacity: 0.6,
  },
  reminderSkipText: {
    fontSize: 15,
    color: colors.text.primary60,
  },
})
