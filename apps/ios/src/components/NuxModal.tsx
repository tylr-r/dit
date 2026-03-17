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
  index: number;
  total: number;
  result: 'fast' | 'slow' | null;
  avgMs: number | null;
  letter: string;
  onSplashDone: () => void;
  /** Advance welcome→sound_check or sound_check→dit_dah */
  onNext: () => void;
  /** Play a single Morse symbol with haptics */
  onPlaySymbol: (symbol: '.' | '-') => void;
  /** Start the timed exercise (heavy setup) */
  onStart: () => void;
  onSkip: () => void;
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
}

function NuxProgress({ step, letterIndex, total }: NuxProgressProps) {
  const exerciseStart = 3
  const resultSlot = exerciseStart + total
  const totalSlots = resultSlot + 1

  const activeSlot =
    step === 'welcome' ? 0
    : step === 'sound_check' ? 1
    : step === 'dit_dah' ? 2
    : step === 'exercise' ? exerciseStart + letterIndex
    : resultSlot

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
  index,
  total,
  result,
  avgMs,
  letter,
  onSplashDone,
  onNext,
  onPlaySymbol,
  onStart,
  onSkip,
  onFinish,
  onChoosePreset,
}: NuxModalProps) {
  const insets = useSafeAreaInsets()
  const { fadeAnim, slideAnim } = useStepTransition(step)
  const animStyle = { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
  const paddingTop = insets.top + spacing.xl
  const paddingBottom = insets.bottom + spacing.xl

  if (step === 'splash') {
    return (
      <SplashStep
        onSplashDone={onSplashDone}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
      />
    )
  }

  if (step === 'welcome') {
    return (
      <View style={styles.fullScreen} pointerEvents="auto" accessibilityViewIsModal>
        <Animated.View style={[styles.welcomeContent, { paddingTop, paddingBottom }, animStyle]}>
          <View style={styles.progressRow}>
            <NuxProgress step="welcome" letterIndex={0} total={total} />
          </View>
          <View style={styles.heroArea}>
            <View style={styles.logoRing}>
              <DitLogo size={130} opacity={0.85} />
            </View>
          </View>
          <View style={styles.copyArea}>
            <Text style={styles.headline}>Let's find your speed</Text>
            <Text style={styles.subtext}>
              Tap 6 letters and we'll auto configure settings.
            </Text>
          </View>
          <View style={styles.ctaArea}>
            <DitButton text="Start quick exercise" onPress={onNext} style={styles.ctaButton} textStyle={ctaTextStyle} radius={radii.pill} paddingVertical={16} glassEffectStyle="clear" />
            <Pressable
              onPress={onSkip}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip personalization"
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
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
    const progressItems = Array.from({ length: total })
    return (
      <View style={styles.fullScreen} pointerEvents="box-none" accessibilityViewIsModal>
        <Animated.View
          style={[
            styles.exerciseContent,
            { paddingTop, paddingBottom: paddingBottom + 120 },
            animStyle,
          ]}
          pointerEvents="none"
        >
          <View style={styles.progressRow}>
            <NuxProgress step="exercise" letterIndex={index} total={total} />
          </View>
          <View style={styles.letterArea}>
            <Text style={styles.tapLabel}>TAP THIS LETTER</Text>
            <Text style={styles.bigLetter}>{letter}</Text>
          </View>
          <View style={styles.exerciseFooter}>
            {progressItems.map((_, i) => {
              const isDone = i < index
              const isActive = i === index
              return (
                <View
                  key={`letter-${i}`}
                  style={[
                    styles.letterDot,
                    isDone && styles.letterDotDone,
                    isActive && styles.letterDotActive,
                  ]}
                />
              )
            })}
          </View>
        </Animated.View>
      </View>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  const isFast = result === 'fast'
  const gaugeColor = isFast ? colors.feedback.success : colors.accent.wave
  const resultHeadline = isFast ? "You're quick" : 'Great start'
  const presetName = isFast ? 'advanced' : 'beginner'
  const resultSubtext = `We've set you up with ${presetName} defaults. You can always adjust later.`
  const timeDisplay = avgMs !== null ? `${(avgMs / 1000).toFixed(1)}s` : '—'

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
          <DitButton text="Let's go" onPress={onFinish} style={styles.ctaButton} textStyle={ctaTextStyle} radius={radii.pill} paddingVertical={16} glassEffectStyle="clear" />
        </View>
      </Animated.View>
    </View>
  )
}

// ─── Splash ───────────────────────────────────────────────────────────────────

function SplashStep({
  onSplashDone,
  paddingTop,
  paddingBottom,
}: {
  onSplashDone: () => void
  paddingTop: number
  paddingBottom: number
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: true,
    })
    animation.start()
    const timer = setTimeout(onSplashDone, 2400)
    return () => {
      clearTimeout(timer)
      animation.stop()
    }
  }, []) // intentionally empty — splash runs once on mount

  return (
    <View style={styles.fullScreen} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View
        style={[styles.splashContent, { paddingTop, paddingBottom }, { opacity: fadeAnim }]}
      >
        <View style={styles.splashLogoWrap}>
          <DitLogo size={96} opacity={0.9} />
        </View>
        <Text style={styles.splashTitle}>Welcome to Dit</Text>
      </Animated.View>
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
          <Text style={styles.subtext}>
            Learning by ear is faster — you don't need to know any Morse code yet.
          </Text>
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
          <DitButton text="Sounds good" onPress={onNext} style={styles.ctaButton} textStyle={ctaTextStyle} radius={radii.pill} paddingVertical={16} glassEffectStyle="clear" />
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
          <Text style={styles.subtext}>
            Two sounds — short and long. Morse is made of them.
          </Text>
        </View>

        <View style={styles.ditDahCards}>
          <GlassView
            glassEffectStyle="clear"
            isInteractive
            style={[styles.symbolRow, tappedDit && styles.symbolRowTapped]}
          >
            <Pressable
              onPress={() => { onPlaySymbol('.'); setTappedDit(true) }}
              style={({ pressed }) => [
                styles.symbolPressable,
                pressed && styles.symbolPressed,
              ]}
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
              onPress={() => { onPlaySymbol('-'); setTappedDah(true) }}
              style={({ pressed }) => [
                styles.symbolPressable,
                pressed && styles.symbolPressed,
              ]}
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
          <DitButton text="Got it, let's go" onPress={onStart} style={styles.ctaButton} textStyle={ctaTextStyle} radius={radii.pill} paddingVertical={16} glassEffectStyle="clear" />
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
  splashContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  splashLogoWrap: {
    marginBottom: spacing.md,
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
  letterArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  bigLetter: {
    fontSize: 108,
    fontWeight: '200',
    color: colors.text.primary,
    lineHeight: 120,
  },
  exerciseFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingBottom: spacing.lg,
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
    backgroundColor: colors.accent.wave,
    borderColor: colors.accent.wave,
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
