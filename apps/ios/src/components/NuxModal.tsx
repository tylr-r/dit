import { MaterialIcons } from '@expo/vector-icons'
import { SymbolView } from 'expo-symbols'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { normalizeColorForNative } from '../design/color'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'

type NuxStep =
  | 'profile'
  | 'sound_check'
  | 'button_tutorial'
  | 'known_tour'
  | 'beginner_intro'

type NuxModalProps = {
  step: NuxStep
  learnerProfile: 'beginner' | 'known' | null
  soundChecked: boolean
  didCompleteTutorialTap: boolean
  didCompleteTutorialHold: boolean
  currentPack: string[]
  onChooseProfile: (profile: 'beginner' | 'known') => void
  onPlaySoundCheck: () => void
  onContinueFromSoundCheck: () => void
  onPlayDitDemo: () => void
  onPlayDahDemo: () => void
  onCompleteButtonTutorial: () => void
  onFinishKnownTour: () => void
  onStartBeginnerCourse: () => void
}

const progressIndexByStep: Record<NuxStep, number> = {
  profile: 0,
  sound_check: 1,
  button_tutorial: 2,
  known_tour: 3,
  beginner_intro: 3,
}

function ProgressDots({ step }: { step: NuxStep }) {
  const total = 4
  const activeIndex = progressIndexByStep[step]

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, index) => {
        const isDone = index < activeIndex
        const isActive = index === activeIndex
        return (
          <View
            key={index}
            style={[
              styles.progressDot,
              isDone && styles.progressDotDone,
              isActive && styles.progressDotActive,
            ]}
          />
        )
      })}
    </View>
  )
}

const ChecklistRow = ({ label, complete }: { label: string; complete: boolean }) => (
  <View style={styles.checkRow}>
    <View style={[styles.checkDot, complete && styles.checkDotComplete]} />
    <Text style={styles.checkText}>{label}</Text>
  </View>
)

function NuxIcon({ sfName, materialName, size, color }: {
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
        fallback={
          <MaterialIcons name={materialName as any} size={size} color={tint} />
        }
      />
    </View>
  )
}

/** Full-screen first-run flow for profile selection and basic app teaching. */
export function NuxModal({
  step,
  learnerProfile,
  soundChecked,
  didCompleteTutorialTap,
  didCompleteTutorialHold,
  currentPack,
  onChooseProfile,
  onPlaySoundCheck,
  onContinueFromSoundCheck,
  onPlayDitDemo,
  onPlayDahDemo,
  onCompleteButtonTutorial,
  onFinishKnownTour,
  onStartBeginnerCourse,
}: NuxModalProps) {
  const insets = useSafeAreaInsets()
  const paddingTop = insets.top + spacing.xl
  const paddingBottom = insets.bottom + spacing.xl
  const isTutorial = step === 'button_tutorial'

  return (
    <View
      style={styles.overlay}
      pointerEvents={isTutorial ? 'box-none' : undefined}
      accessibilityViewIsModal={!isTutorial}
    >
      <View
        style={[
          styles.content,
          { paddingTop, paddingBottom },
          isTutorial && styles.contentTutorial,
        ]}
        pointerEvents={isTutorial ? 'box-none' : undefined}
      >
        <ProgressDots step={step} />

        {step === 'profile' ? (
          <>
            <View style={styles.copyBlock}>
              <Text style={styles.headline}>Choose your path</Text>
              <Text style={styles.subtext}>
                Pick the option that fits your experience.
              </Text>
            </View>
            <View style={styles.optionColumn}>
              <Pressable
                onPress={() => onChooseProfile('beginner')}
                style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
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
                <Text style={styles.optionBody}>
                  Start from the basics and build up.
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onChooseProfile('known')}
                style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
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
                <Text style={styles.optionBody}>
                  Quick tour, then dive right in.
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 'sound_check' ? (
          <>
            <View style={styles.copyBlock}>
              <Text style={styles.headline}>Check your sound</Text>
              <Text style={styles.subtext}>
                Turn your volume up, then tap below to confirm you can hear the tones.
              </Text>
            </View>
            <Pressable
              onPress={onPlaySoundCheck}
              style={({ pressed }) => [
                styles.soundButton,
                soundChecked && styles.soundButtonComplete,
                pressed && styles.optionCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Test sound"
            >
              {soundChecked ? (
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
              <Text style={[
                styles.soundButtonText,
                soundChecked && { color: colors.feedback.success, fontSize: 16 },
              ]}>
                {soundChecked ? 'Sound works' : 'Test sound'}
              </Text>
            </Pressable>
            <View style={styles.bottomBlock}>
              <DitButton
                text="Continue"
                onPress={onContinueFromSoundCheck}
                disabled={!soundChecked}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            </View>
          </>
        ) : null}

        {step === 'button_tutorial' ? (
          <>
            <View style={styles.copyBlock}>
              <Text style={styles.headline}>Meet the Morse key</Text>
              <Text style={styles.subtext}>
                The large key below is how you tap answers. Listen to the
                difference, then try each one.
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Listen first</Text>
              <View style={styles.demoRow}>
                <Pressable
                  onPress={onPlayDitDemo}
                  style={({ pressed }) => [
                    styles.demoButton,
                    pressed && styles.optionCardPressed,
                  ]}
                >
                  <NuxIcon
                    sfName="play.fill"
                    materialName="play-arrow"
                    size={16}
                    color={colors.text.primary90}
                  />
                  <Text style={styles.demoButtonText}>Short tap (dit)</Text>
                </Pressable>
                <Pressable
                  onPress={onPlayDahDemo}
                  style={({ pressed }) => [
                    styles.demoButton,
                    pressed && styles.optionCardPressed,
                  ]}
                >
                  <NuxIcon
                    sfName="play.fill"
                    materialName="play-arrow"
                    size={16}
                    color={colors.text.primary90}
                  />
                  <Text style={styles.demoButtonText}>Long hold (dah)</Text>
                </Pressable>
              </View>
              <View style={styles.cardDivider} />
              <Text style={styles.cardLabel}>Now you try</Text>
              <ChecklistRow label="Short tap (dit)" complete={didCompleteTutorialTap} />
              <ChecklistRow label="Long hold (dah)" complete={didCompleteTutorialHold} />
            </View>
            <DitButton
              text={learnerProfile === 'known' ? 'Show me the app' : 'Start learning'}
              onPress={onCompleteButtonTutorial}
              disabled={!didCompleteTutorialTap || !didCompleteTutorialHold}
              style={styles.ctaButton}
              radius={radii.pill}
              paddingVertical={16}
            />
          </>
        ) : null}

        {step === 'known_tour' ? (
          <>
            <View style={styles.copyBlock}>
              <Text style={styles.headline}>Quick app tour</Text>
              <Text style={styles.subtext}>
                Practice shows the target, Play replays it, the logo opens reference, and Settings
                handles helpers, speed, and sync.
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.bullet}>Practice: send the shown character</Text>
              <Text style={styles.bullet}>Freestyle: tap whatever you want and decode it</Text>
              <Text style={styles.bullet}>Listen: hear a letter and type the answer</Text>
            </View>
            <View style={styles.bottomBlock}>
              <DitButton
                text="Start practicing"
                onPress={onFinishKnownTour}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            </View>
          </>
        ) : null}

        {step === 'beginner_intro' ? (
          <>
            <View style={styles.copyBlock}>
              <Text style={styles.headline}>Your first letters</Text>
              <Text style={styles.subtext}>
                Each pack introduces a few letters at a time through three stages.
              </Text>
            </View>
            <View style={styles.stepsColumn}>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Listen</Text>
                  <Text style={styles.stepDesc}>Hear each letter and copy the sound</Text>
                </View>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Practice</Text>
                  <Text style={styles.stepDesc}>Mix old and new letters by ear</Text>
                </View>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Recall</Text>
                  <Text style={styles.stepDesc}>Hear a letter, tap the matching sound</Text>
                </View>
              </View>
            </View>
            <View style={styles.packPreview}>
              <Text style={styles.packLabel}>Starting with</Text>
              <View style={styles.packChips}>
                {currentPack.map((letter) => (
                  <View key={letter} style={styles.packChip}>
                    <Text style={styles.chipLetter}>{letter}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.packHint}>Tap a letter in-app to hear it</Text>
            </View>
            <View style={styles.bottomBlock}>
              <DitButton
                text="Start first lesson"
                onPress={onStartBeginnerCourse}
                style={styles.ctaButton}
                radius={radii.pill}
                paddingVertical={16}
              />
            </View>
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  contentTutorial: {
    justifyContent: 'flex-start',
    gap: spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.text.primary20,
  },
  progressDotActive: {
    width: 20,
    backgroundColor: colors.text.primary,
  },
  progressDotDone: {
    backgroundColor: colors.feedback.success,
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
  optionCardPressed: {
    opacity: 0.75,
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
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.primary40,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  demoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface.input,
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary90,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.text.primary20,
  },
  checkDotComplete: {
    backgroundColor: colors.feedback.success,
    borderColor: colors.feedback.success,
  },
  checkText: {
    fontSize: 15,
    color: colors.text.primary90,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.primary90,
  },
  stepsColumn: {
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%' as unknown as number,
    maxWidth: 280,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary60,
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  stepDesc: {
    fontSize: 13,
    color: colors.text.primary40,
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
  bottomBlock: {
    gap: spacing.md,
  },
  ctaButton: {
    width: '100%' as unknown as number,
  },
})
