import { MaterialIcons } from '@expo/vector-icons'
import { SymbolView } from 'expo-symbols'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { normalizeColorForNative } from '../design/color'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'
import DitLogo from './DitLogo'

type NuxStep =
  | 'welcome'
  | 'profile'
  | 'sound_check'
  | 'button_tutorial'
  | 'known_tour'
  | 'beginner_stages'
  | 'beginner_intro'

type NuxModalProps = {
  step: NuxStep
  learnerProfile: 'beginner' | 'known' | null
  soundChecked: boolean
  tutorialTapCount: number
  tutorialHoldCount: number
  currentPack: string[]
  onWelcomeDone: () => void
  onChooseProfile: (profile: 'beginner' | 'known') => void
  onPlaySoundCheck: () => void
  onContinueFromSoundCheck: () => void
  onPlayDitDemo: () => void
  onPlayDahDemo: () => void
  onCompleteButtonTutorial: () => void
  onFinishKnownTour: () => void
  onContinueFromStages: () => void
  onStartBeginnerCourse: () => void
}

// ─── Custom easing curves ─────────────────────────────────────────────────────
// Stronger than built-in quad — gives animations that punchy, intentional feel.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1)

// Reserved footer height so stepBody keeps the same available space across
// steps that do and don't render a CTA — matches DitButton intrinsic height
// with paddingVertical=16 + 11pt text.
const CTA_SLOT_HEIGHT = 48

// ─── Step body transition ─────────────────────────────────────────────────────
// Only animates the step body content — ProgressDots stay static as a spatial
// anchor so the user always knows where they are.

function useStepTransition(step: NuxStep) {
  const [displayedStep, setDisplayedStep] = useState<NuxStep>(step)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const scaleAnim = useRef(new Animated.Value(1)).current
  const prevStep = useRef(step)

  useEffect(() => {
    if (prevStep.current === step) return
    prevStep.current = step

    // Exit: quick fade + slight scale up (content recedes)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.04,
        duration: 120,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDisplayedStep(step)
      scaleAnim.setValue(0.96)
      fadeAnim.setValue(0)

      // Enter: spring scale from 0.96 → 1.0 + fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 280,
          friction: 24,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }, [step, fadeAnim, scaleAnim])

  return { displayedStep, fadeAnim, scaleAnim }
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

  if (anims.current.length !== count) {
    anims.current = Array.from({ length: count }, () => new Animated.Value(0))
    yAnims.current = Array.from({ length: count }, () => new Animated.Value(startY))
  }

  useEffect(() => {
    // Reset all values
    anims.current.forEach((a) => a.setValue(0))
    yAnims.current.forEach((a) => a.setValue(startY))

    const animations = anims.current.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          delay: i * stepDelay,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(yAnims.current[i], {
          toValue: 0,
          duration,
          delay: i * stepDelay,
          easing: EASE_OUT,
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
      easing: EASE_IN_OUT,
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
  const total = 4
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
        easing: EASE_OUT,
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

function WelcomeScreen({ onWelcomeDone }: { onWelcomeDone: () => void }) {
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.9)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const titleY = useRef(new Animated.Value(12)).current

  useEffect(() => {
    // Logo fades in first
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 120,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start()

    // Title follows after a beat
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 500,
        delay: 300,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(titleY, {
        toValue: 0,
        duration: 500,
        delay: 300,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start()
  }, [logoOpacity, logoScale, titleOpacity, titleY])

  return (
    <Pressable
      style={styles.welcomeScreen}
      onPress={onWelcomeDone}
      accessibilityLabel="Welcome to Dit"
    >
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <DitLogo size={120} opacity={0.9} animated />
      </Animated.View>
      <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
        <Text style={styles.welcomeTitle}>Welcome to Dit</Text>
      </Animated.View>
    </Pressable>
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
      easing: EASE_OUT,
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

/** Full-screen first-run flow for profile selection and basic app teaching. */
export function NuxModal({
  step,
  soundChecked,
  tutorialTapCount,
  tutorialHoldCount,
  currentPack,
  onWelcomeDone,
  onChooseProfile,
  onPlaySoundCheck,
  onContinueFromSoundCheck,
  onPlayDitDemo,
  onPlayDahDemo,
  onCompleteButtonTutorial,
  onFinishKnownTour,
  onContinueFromStages,
  onStartBeginnerCourse,
}: NuxModalProps) {
  const insets = useSafeAreaInsets()
  const paddingTop = insets.top + spacing.xl
  const paddingBottom = insets.bottom + spacing.xl
  const isTutorial = step === 'button_tutorial'

  const { displayedStep, fadeAnim, scaleAnim } = useStepTransition(step)
  const bodyAnimStyle = { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }

  // Stagger counts per step
  const staggerCounts: Record<NuxStep, number> = {
    welcome: 0,
    profile: 2,
    sound_check: 2,
    button_tutorial: 2,
    known_tour: 2,
    beginner_stages: 4,
    beginner_intro: 2,
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

  useEffect(() => {
    if (step !== 'welcome') return
    const timer = setTimeout(onWelcomeDone, 2200)
    return () => clearTimeout(timer)
  }, [step, onWelcomeDone])

  const TUTORIAL_REQUIRED = 3
  // Auto-advance once both tutorial inputs are completed
  useEffect(() => {
    if (step !== 'button_tutorial') return
    if (tutorialTapCount < TUTORIAL_REQUIRED || tutorialHoldCount < TUTORIAL_REQUIRED) return
    const timer = setTimeout(onCompleteButtonTutorial, 600)
    return () => clearTimeout(timer)
  }, [step, tutorialTapCount, tutorialHoldCount, onCompleteButtonTutorial])

  return (
    <View
      style={styles.overlay}
      pointerEvents={isTutorial ? 'box-none' : undefined}
      accessibilityViewIsModal={!isTutorial}
    >
      {displayedStep === 'welcome' ? (
        <WelcomeScreen onWelcomeDone={onWelcomeDone} />
      ) : (
        <View
          style={[styles.content, { paddingTop, paddingBottom }]}
          pointerEvents={isTutorial ? 'box-none' : undefined}
        >
          {/* ProgressDots stay OUTSIDE the body transition — spatial anchor */}
          <ProgressDots step={displayedStep} />

          <Animated.View
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
                    <ScalePressable
                      onPress={() => onChooseProfile('beginner')}
                      style={styles.optionCard}
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
                    </ScalePressable>
                    <ScalePressable
                      onPress={() => onChooseProfile('known')}
                      style={styles.optionCard}
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
                    </ScalePressable>
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
                      onPress={onPlaySoundCheck}
                      style={[styles.soundButton, soundChecked && styles.soundButtonComplete]}
                      accessibilityRole="button"
                      accessibilityLabel="Test sound"
                    >
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
                    Listen to each sound, then try it on the key below.
                  </Text>
                </Animated.View>
                <View style={styles.stepFill}>
                  <Animated.View style={[styles.tutorialRows, stagger[1]]}>
                    <View style={styles.tutorialRow}>
                      <ScalePressable
                        onPress={onPlayDitDemo}
                        style={styles.tutorialPlayButton}
                        accessibilityLabel="Play dit sound"
                      >
                        <NuxIcon
                          sfName="play.fill"
                          materialName="play-arrow"
                          size={14}
                          color={colors.text.primary}
                        />
                      </ScalePressable>
                      <Text style={styles.tutorialLabel}>Short tap (dit)</Text>
                      <TutorialProgress count={tutorialTapCount} required={TUTORIAL_REQUIRED} />
                    </View>
                    <View style={styles.tutorialRow}>
                      <ScalePressable
                        onPress={onPlayDahDemo}
                        style={styles.tutorialPlayButton}
                        accessibilityLabel="Play dah sound"
                      >
                        <NuxIcon
                          sfName="play.fill"
                          materialName="play-arrow"
                          size={14}
                          color={colors.text.primary}
                        />
                      </ScalePressable>
                      <Text style={styles.tutorialLabel}>Long hold (dah)</Text>
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
                  <Animated.View style={[styles.stageCard, stagger[1]]}>
                    <Text style={styles.stageNumberLarge}>1</Text>
                    <Text style={styles.stageTitleLarge}>Listen</Text>
                    <Text style={styles.stageDescLarge}>
                      Hear each letter and copy the sound
                    </Text>
                  </Animated.View>
                  <Animated.View style={[styles.stageCard, stagger[2]]}>
                    <Text style={styles.stageNumberLarge}>2</Text>
                    <Text style={styles.stageTitleLarge}>Practice</Text>
                    <Text style={styles.stageDescLarge}>
                      Mix old and new letters by ear
                    </Text>
                  </Animated.View>
                  <Animated.View style={[styles.stageCard, stagger[3]]}>
                    <Text style={styles.stageNumberLarge}>3</Text>
                    <Text style={styles.stageTitleLarge}>Recall</Text>
                    <Text style={styles.stageDescLarge}>
                      Hear a letter, tap the matching sound
                    </Text>
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
                  <Animated.View style={[styles.packPreview, stagger[1]]}>
                    <Text style={styles.packLabel}>We'll start with</Text>
                    <View style={styles.packChips}>
                      {currentPack.map((letter) => (
                        <View key={letter} style={styles.packChip}>
                          <Text style={styles.chipLetter}>{letter}</Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                </View>
              </>
            ) : null}
          </Animated.View>

          {/* CTA slot is always rendered with a fixed height so stepBody has
              the same available space on every step — keeps vertical centering
              consistent whether or not the step has a button. GlassView can't
              live inside the animated body (animated opacity breaks it). */}
          <View style={styles.ctaSlot}>
            {displayedStep === 'sound_check' ? (
              <DitButton
                text="Continue"
                onPress={onContinueFromSoundCheck}
                disabled={!soundChecked}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
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
                onPress={onContinueFromStages}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            ) : null}
            {displayedStep === 'beginner_intro' ? (
              <DitButton
                text="Start first lesson"
                onPress={onStartBeginnerCourse}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            ) : null}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  welcomeScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
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
    gap: 44,
  },
  stageCard: {
    alignItems: 'center',
    gap: 6,
  },
  stageNumberLarge: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.text.primary40,
  },
  stageTitleLarge: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  stageDescLarge: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary60,
    textAlign: 'center',
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
  packChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.panelStrong,
    gap: 4,
  },
  chipLetter: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text.primary,
  },
  packHint: {
    fontSize: 13,
    color: colors.text.primary40,
    fontStyle: 'italic',
  },
  tutorialRows: {
    gap: spacing.md,
  },
  tutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface.input,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  tutorialPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface.inputPressed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary90,
  },
  ctaSlot: {
    height: CTA_SLOT_HEIGHT,
    justifyContent: 'center',
  },
  ctaButton: {
    width: '100%' as unknown as number,
  },
})
