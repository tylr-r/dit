import { GlassView } from 'expo-glass-effect'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'
import DitLogo from './DitLogo'

type NuxStep = 'splash' | 'welcome' | 'sound_check' | 'dit_dah' | 'exercise' | 'result'

type NuxModalProps = {
  step: NuxStep;
  status: 'idle' | 'success' | 'error';
  index: number;
  total: number;
  result: 'fast' | 'slow' | 'skipped' | null;
  avgMs: number | null;
  letter: string;
  onSplashDone: () => void;
  /** Advance welcome→sound_check or sound_check→dit_dah */
  onNext: () => void;
  /** Play a single Morse symbol with haptics */
  onPlaySymbol: (symbol: '.' | '-') => void;
  /** Start the timed exercise (heavy setup) */
  onStart: () => void;
  onReplayLetter: () => void;
  onSkip: () => void;
  /** Skip the exercise entirely and apply beginner settings */
  onSkipExercise: () => void;
  onFinish: () => void;
  onChoosePreset: (preset: 'beginner' | 'advanced') => void;
};

// ─── Unified progress indicator ───────────────────────────────────────────────
//
// Slots: welcome(0) sound_check(1) dit_dah(2) exercise×total(3…) result(3+total)

type NuxProgressProps = {
  step: 'welcome' | 'sound_check' | 'dit_dah' | 'exercise' | 'result';
  letterIndex: number;
  total: number;
};

function NuxProgress({ step, letterIndex, total }: NuxProgressProps) {
  const exerciseStart = 3;
  const resultSlot = exerciseStart + total;
  const totalSlots = resultSlot + 1;

  const activeSlot =
    step === 'welcome'
      ? 0
      : step === 'sound_check'
      ? 1
      : step === 'dit_dah'
      ? 2
      : step === 'exercise'
      ? exerciseStart + letterIndex
      : resultSlot;

  return (
    <View style={progressStyles.row}>
      {Array.from({ length: totalSlots }).map((_, i) => {
        const isSubStep = i >= exerciseStart && i < resultSlot
        const isDone = i < activeSlot
        const isActive = i === activeSlot
        return (
          <View
            key={i}
            style={[
              progressStyles.dot,
              isSubStep && progressStyles.subDot,
              isDone && progressStyles.dotDone,
              isActive && !isSubStep && progressStyles.dotActive,
              isActive && isSubStep && progressStyles.subDotActive,
            ]}
          />
        )
      })}
    </View>
  )
}

const progressStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.primary20,
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.primary,
  },
  dotDone: {
    backgroundColor: colors.feedback.success,
    opacity: 0.7,
  },
  subDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.primary20,
  },
  subDotActive: {
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.primary,
  },
})

// ─── Primary CTA ──────────────────────────────────────────────────────────────

const ctaTextStyle = {
  fontSize: 16,
  fontWeight: '600' as const,
  letterSpacing: 0.3,
  textTransform: 'none' as const,
}

// ─── Step transition hook ─────────────────────────────────────────────────────

function useStepTransition(step: string) {
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const prevStep = useRef(step)

  useEffect(() => {
    if (prevStep.current === step) return
    prevStep.current = step
    fadeAnim.setValue(0)
    slideAnim.setValue(16)
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 440, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 440, useNativeDriver: true }),
    ]).start()
  }, [step, fadeAnim, slideAnim])

  return { fadeAnim, slideAnim }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NuxModal({
  step,
  status,
  index,
  total,
  result,
  avgMs,
  letter,
  onSplashDone,
  onNext,
  onPlaySymbol,
  onReplayLetter,
  onStart,
  onSkip,
  onSkipExercise,
  onFinish,
  onChoosePreset,
}: NuxModalProps) {
  const insets = useSafeAreaInsets()
  const { fadeAnim, slideAnim } = useStepTransition(step)
  const animStyle = { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
  const paddingTop = insets.top + spacing.xl
  const paddingBottom = insets.bottom + spacing.xl

  if (step === 'splash' || step === 'welcome') {
    return (
      <SplashWelcomeStep
        step={step}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        total={total}
        onSplashDone={onSplashDone}
        onNext={onNext}
        onSkip={onSkip}
      />
    )
  }

  if (step === 'sound_check') {
    return (
      <SoundCheckStep
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        animStyle={animStyle}
        total={total}
        onPlaySymbol={onPlaySymbol}
        onNext={onNext}
      />
    )
  }

  if (step === 'dit_dah') {
    return (
      <DitDahStep
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        animStyle={animStyle}
        total={total}
        onPlaySymbol={onPlaySymbol}
        onStart={onStart}
      />
    )
  }

  if (step === 'exercise') {
    const progressItems = Array.from({ length: total });
    const isError = status === 'error';
    return (
      <View style={styles.fullScreen} pointerEvents="box-none" accessibilityViewIsModal>
        <Animated.View
          style={[
            styles.exerciseContent,
            { paddingTop, paddingBottom: paddingBottom + 72 },
            animStyle,
          ]}
          pointerEvents="box-none"
        >
          {/* Top */}
          <View pointerEvents="none">
            <View style={styles.progressRow}>
              <NuxProgress step="exercise" letterIndex={index} total={total} />
            </View>
            <Text style={styles.tapLabel}>TAP WHAT YOU HEAR</Text>
          </View>

          {/* Letter group */}
          <View style={styles.letterGroup} pointerEvents="box-none">
            <Pressable
              onPress={onReplayLetter}
              style={({ pressed }) => [styles.replayBtn, pressed && styles.replayBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Hear this letter"
            >
              <Text style={styles.replayBtnText}>▶ play sound</Text>
            </Pressable>
            <Text style={[styles.bigLetter, isError && styles.bigLetterError]}>{letter}</Text>
            <Text style={[styles.errorHint, isError && styles.errorHintVisible]}>
              Not quite. Try again
            </Text>
            <View style={styles.exerciseFooter}>
              {progressItems.map((_, i) => {
                const isDone = i < index;
                const isActive = i === index;
                return (
                  <View
                    key={`letter-${i}`}
                    style={[
                      styles.letterDot,
                      isDone && styles.letterDotDone,
                      isActive && styles.letterDotActive,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Bottom */}
          <View style={styles.exerciseBottom} pointerEvents="box-none">
            <Pressable
              onPress={onSkipExercise}
              style={({ pressed }) => [
                styles.exerciseSkipBtn,
                pressed && styles.exerciseSkipBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Skip test and use beginner settings"
            >
              <Text style={styles.exerciseSkipText}>skip exercise</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  const isFast = result === 'fast';
  const gaugeColor = isFast ? colors.feedback.success : colors.accent.wave;
  const resultHeadline = isFast
    ? "You're quick"
    : result === 'skipped'
    ? 'No problem'
    : 'Great start';
  const presetName = isFast ? 'advanced' : 'beginner';
  const resultSubtext = `We've set you up with ${presetName} defaults. You can always adjust later.`;
  const timeDisplay = avgMs !== null ? `${(avgMs / 1000).toFixed(1)}s` : '—';

  return (
    <View style={styles.fullScreen} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View style={[styles.resultContent, { paddingTop, paddingBottom }, animStyle]}>
        <View style={styles.progressRow}>
          <NuxProgress step="result" letterIndex={total - 1} total={total} />
        </View>
        <View style={styles.gaugeArea}>
          <View style={[styles.gaugeOuter, { borderColor: gaugeColor + '30' }]}>
            <View style={[styles.gaugeRing, { borderColor: gaugeColor }]}>
              <Text style={[styles.gaugeTime, { color: gaugeColor }]}>{timeDisplay}</Text>
              <Text style={styles.gaugeLabel}>avg. response</Text>
            </View>
          </View>
        </View>
        <View style={styles.resultCopy}>
          <Text style={styles.headline}>{resultHeadline}</Text>
          <Text style={styles.subtext}>{resultSubtext}</Text>
        </View>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => onChoosePreset('advanced')}
            style={({ pressed }) => [
              styles.chip,
              isFast ? styles.chipSelected : styles.chipGhost,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="radio"
            accessibilityLabel="Advanced preset"
            accessibilityState={{ selected: isFast }}
          >
            <Text style={[styles.chipText, isFast && styles.chipTextSelected]}>Advanced</Text>
          </Pressable>
          <Pressable
            onPress={() => onChoosePreset('beginner')}
            style={({ pressed }) => [
              styles.chip,
              !isFast ? styles.chipSelected : styles.chipGhost,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="radio"
            accessibilityLabel="Beginner preset"
            accessibilityState={{ selected: !isFast }}
          >
            <Text style={[styles.chipText, !isFast && styles.chipTextSelected]}>Beginner</Text>
          </Pressable>
        </View>
        <View style={styles.ctaArea}>
          <DitButton
            text="Let's go"
            onPress={onFinish}
            style={styles.ctaButton}
            textStyle={ctaTextStyle}
            radius={radii.pill}
            paddingVertical={16}
            glassEffectStyle="clear"
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Splash / Welcome shared view ────────────────────────────────────────────
//
// Both steps share a single layout so the logo never unmounts. The splash title
// crossfades into the welcome copy/progress/CTA using animated opacities.

function SplashWelcomeStep({
  step,
  paddingTop,
  paddingBottom,
  total,
  onSplashDone,
  onNext,
  onSkip,
}: {
  step: 'splash' | 'welcome'
  paddingTop: number
  paddingBottom: number
  total: number
  onSplashDone: () => void
  onNext: () => void
  onSkip: () => void
}) {
  // Splash title: fades in on mount, fades out when step becomes 'welcome'
  const splashOpacity = useRef(new Animated.Value(0)).current
  // Welcome elements: fade in when step becomes 'welcome'
  const welcomeOpacity = useRef(new Animated.Value(0)).current

  // Splash entrance
  useEffect(() => {
    Animated.timing(splashOpacity, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: true,
    }).start()
    const timer = setTimeout(onSplashDone, 2400)
    return () => clearTimeout(timer)
  }, []) // intentionally empty — runs once on mount

  // Crossfade splash → welcome
  useEffect(() => {
    if (step !== 'welcome') return
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start()
  }, [step, splashOpacity, welcomeOpacity])

  return (
    <View style={styles.fullScreen} pointerEvents="auto" accessibilityViewIsModal>
      <View style={[styles.welcomeContent, { paddingTop, paddingBottom }]}>
        {/* Progress */}
        <Animated.View style={[styles.progressRow, { opacity: welcomeOpacity }]}>
          <NuxProgress step="welcome" letterIndex={0} total={total} />
        </Animated.View>

        {/* Logo — always visible, never animated */}
        <View style={styles.heroArea}>
          <View style={styles.logoRing}>
            <DitLogo size={130} opacity={0.85} animated />
          </View>
        </View>

        {/* Copy — both layers rendered, crossfaded */}
        <View style={styles.copyArea}>
          {/* Splash title (absolute so it doesn't affect layout) */}
          <Animated.View
            style={[styles.splashOverlay, { opacity: splashOpacity }]}
            pointerEvents="none"
          >
            <Text style={styles.splashTitle}>Welcome to Dit</Text>
          </Animated.View>
          {/* Welcome copy */}
          <Animated.View style={{ opacity: welcomeOpacity }}>
            <Text style={styles.headline}>Let's find your level</Text>
            <Text style={[styles.subtext, { marginTop: spacing.md }]}>
              Tap 6 letters and we'll measure your speed and accuracy to auto-configure your
              settings.
            </Text>
          </Animated.View>
        </View>

        {/* CTA — always in the tree so layout stays stable (no logo jump).
             The button itself is NOT wrapped in an opacity Animated.View because
             GlassView can't composite when a parent has opacity 0. Instead the
             button appears instantly on welcome. The skip link fades in. */}
        <View style={styles.ctaArea} pointerEvents={step === 'welcome' ? 'auto' : 'none'}>
          <View style={step === 'splash' ? styles.invisible : undefined}>
            <DitButton
              text="Start quick exercise"
              onPress={onNext}
              style={styles.ctaButton}
              textStyle={ctaTextStyle}
              radius={radii.pill}
              paddingVertical={16}
              glassEffectStyle="clear"
            />
          </View>
          <View style={step === 'splash' ? styles.invisible : undefined}>
            <Pressable
              onPress={onSkip}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip personalization"
            >
              <Text style={styles.skipText}>skip</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── Sound check ──────────────────────────────────────────────────────────────

function SoundCheckStep({
  paddingTop,
  paddingBottom,
  animStyle,
  total,
  onPlaySymbol,
  onNext,
}: {
  paddingTop: number
  paddingBottom: number
  animStyle: StyleProp<ViewStyle>
  total: number
  onPlaySymbol: (symbol: '.' | '-') => void
  onNext: () => void
}) {
  const [hasTapped, setHasTapped] = useState(false)

  const handleTap = () => {
    onPlaySymbol('.')
    setHasTapped(true)
  }

  return (
    <View style={styles.fullScreen} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View style={[styles.soundCheckContent, { paddingTop, paddingBottom }, animStyle]}>
        <View style={styles.progressRow}>
          <NuxProgress step="sound_check" letterIndex={0} total={total} />
        </View>

        <View style={styles.soundCheckMain}>
          <Text style={styles.headline}>Sound check</Text>
          <Text style={styles.subtext}>Learning by ear is more effective long-term.</Text>
        </View>

        <View style={styles.soundCheckInteractive}>
          <Text style={styles.tapLabel}>TAP TO HEAR</Text>
          <Pressable
            onPress={handleTap}
            style={({ pressed }) => [
              styles.soundCircle,
              pressed && styles.soundCirclePressed,
              hasTapped && styles.soundCircleTapped,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Tap to hear Morse code for E"
          >
            <Text style={styles.soundCircleLetter}>E</Text>
          </Pressable>
        </View>

        <View style={styles.ctaArea}>
          <DitButton
            text="Sounds good"
            onPress={onNext}
            style={styles.ctaButton}
            textStyle={ctaTextStyle}
            radius={radii.pill}
            paddingVertical={16}
            glassEffectStyle="clear"
          />
        </View>
      </Animated.View>
    </View>
  )
}

// ─── Dit vs Dah ───────────────────────────────────────────────────────────────

function DitDahStep({
  paddingTop,
  paddingBottom,
  animStyle,
  total,
  onPlaySymbol,
  onStart,
}: {
  paddingTop: number
  paddingBottom: number
  animStyle: StyleProp<ViewStyle>
  total: number
  onPlaySymbol: (symbol: '.' | '-') => void
  onStart: () => void
}) {
  const [tappedDit, setTappedDit] = useState(false)
  const [tappedDah, setTappedDah] = useState(false)

  return (
    <View style={styles.fullScreen} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View style={[styles.ditDahContent, { paddingTop, paddingBottom }, animStyle]}>
        <View style={styles.progressRow}>
          <NuxProgress step="dit_dah" letterIndex={0} total={total} />
        </View>

        <View style={styles.ditDahMain}>
          <Text style={styles.headline}>dit · dah</Text>
          <Text style={styles.subtext}>Two sounds. Short and long.</Text>
        </View>

        <View style={styles.ditDahCards}>
          <GlassView
            glassEffectStyle="clear"
            isInteractive
            style={[styles.symbolRow, tappedDit && styles.symbolRowTapped]}
          >
            <Pressable
              onPress={() => {
                onPlaySymbol('.');
                setTappedDit(true);
              }}
              style={({ pressed }) => [styles.symbolPressable, pressed && styles.symbolPressed]}
              accessibilityRole="button"
              accessibilityLabel="Tap to hear dit — short press"
            >
              <Text style={styles.symbolGlyph}>·</Text>
              <View style={styles.symbolInfo}>
                <Text style={styles.symbolName}>DIT</Text>
                <Text style={styles.symbolHint}>short tap</Text>
              </View>
              <Text style={styles.symbolPlay}>▶</Text>
            </Pressable>
          </GlassView>

          <GlassView
            glassEffectStyle="clear"
            isInteractive
            style={[styles.symbolRow, tappedDah && styles.symbolRowTapped]}
          >
            <Pressable
              onPress={() => {
                onPlaySymbol('-');
                setTappedDah(true);
              }}
              style={({ pressed }) => [styles.symbolPressable, pressed && styles.symbolPressed]}
              accessibilityRole="button"
              accessibilityLabel="Tap to hear dah — hold"
            >
              <Text style={styles.symbolGlyph}>—</Text>
              <View style={styles.symbolInfo}>
                <Text style={styles.symbolName}>DAH</Text>
                <Text style={styles.symbolHint}>hold</Text>
              </View>
              <Text style={styles.symbolPlay}>▶</Text>
            </Pressable>
          </GlassView>
        </View>

        <View style={styles.ctaArea}>
          <DitButton
            text="Got it, let's go"
            onPress={onStart}
            style={styles.ctaButton}
            textStyle={ctaTextStyle}
            radius={radii.pill}
            paddingVertical={16}
            glassEffectStyle="clear"
          />
        </View>
      </Animated.View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  progressRow: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  // ── Splash
  invisible: {
    opacity: 0,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    fontSize: 30,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },

  // ── Welcome
  welcomeContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  heroArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  logoRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyArea: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  ctaArea: {
    gap: spacing.md,
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%' as unknown as number,
  },
  skipBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    fontSize: 14,
    color: colors.text.primary40,
    textAlign: 'center',
  },

  // ── Sound check
  soundCheckContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  soundCheckMain: {
    alignItems: 'center',
    gap: spacing.md,
  },
  soundCheckInteractive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tapLabel: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.primary40,
    textAlign: 'center',
  },
  soundCircle: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1.5,
    borderColor: colors.controls.switchTrackOff,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface.input,
  },
  soundCirclePressed: {
    borderColor: colors.accent.wave,
    backgroundColor: colors.surface.inputPressed,
    transform: [{ scale: 0.96 }],
  },
  soundCircleTapped: {
    borderColor: colors.feedback.success,
  },
  soundCircleLetter: {
    fontSize: 64,
    fontWeight: '200',
    color: colors.text.primary,
    lineHeight: 72,
  },
  soundCircleMorse: {
    fontSize: 28,
    color: colors.text.primary60,
    lineHeight: 28,
  },
  replayBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  replayBtnPressed: {
    opacity: 0.6,
  },
  replayBtnText: {
    fontSize: 13,
    color: colors.text.primary40,
    letterSpacing: 0.5,
  },
  exerciseSkipBtn: {
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.text.primary20,
  },
  exerciseSkipBtnPressed: {
    opacity: 0.5,
  },
  exerciseSkipText: {
    fontSize: 13,
    color: colors.text.primary40,
    letterSpacing: 0.3,
  },

  // ── Dit / Dah
  ditDahContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  ditDahMain: {
    alignItems: 'center',
    gap: spacing.md,
  },
  ditDahCards: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  symbolRow: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  symbolRowTapped: {
    borderWidth: 1.5,
    borderColor: colors.feedback.success,
  },
  symbolPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  symbolPressed: {
    opacity: 0.7,
  },
  symbolGlyph: {
    fontSize: 36,
    fontWeight: '200',
    color: colors.text.primary,
    width: 40,
    textAlign: 'center',
  },
  symbolInfo: {
    flex: 1,
    gap: 2,
  },
  symbolName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.primary80,
  },
  symbolHint: {
    fontSize: 13,
    color: colors.text.primary40,
    letterSpacing: 0.3,
  },
  symbolPlay: {
    fontSize: 14,
    color: colors.text.primary40,
  },

  // ── Exercise
  exerciseContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  letterGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  exerciseBottom: {
    alignItems: 'center',
  },
  bigLetter: {
    fontSize: 108,
    fontWeight: '200',
    color: colors.text.primary,
    lineHeight: 120,
  },
  bigLetterError: {
    color: colors.feedback.error,
  },
  errorHint: {
    fontSize: 13,
    color: 'transparent',
    letterSpacing: 0.3,
  },
  errorHintVisible: {
    color: colors.feedback.error,
  },
  exerciseFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  letterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.primary20,
  },
  letterDotActive: {
    backgroundColor: colors.text.primary60,
  },
  letterDotDone: {
    backgroundColor: colors.feedback.success,
  },

  // ── Shared text
  headline: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtext: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary40,
    textAlign: 'center',
  },

  // ── Result
  resultContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  gaugeArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    flex: 1,
  },
  gaugeOuter: {
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gaugeTime: {
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  gaugeLabel: {
    fontSize: 12,
    color: colors.text.primary40,
    letterSpacing: 0.3,
  },
  resultCopy: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.surface.card,
    borderColor: colors.feedback.success,
  },
  chipGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.controls.switchTrackOff,
  },
  chipPressed: { opacity: 0.75 },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary40,
    letterSpacing: 0.2,
  },
  chipTextSelected: { color: colors.text.primary },
})
