import type {
  HeroMetric,
  Letter,
  LetterAccuracyRecord,
  ScoreRecord,
  StreakState,
} from '@dit/core'
import {
  MORSE_DATA,
  STREAK_DAILY_GOAL,
  isMastered,
} from '@dit/core'
import { BlurView } from 'expo-blur'
import { GlassContainer } from 'expo-glass-effect'
import React from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { hslaFromHsl } from '../design/color'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'

type CourseProgress = {
  packIndex: number
  totalPacks: number
  phase: string
  packLetters: string[]
}

type ReferenceModalProps = {
  letters: Letter[]
  numbers: Letter[]
  morseData: Record<Letter, { code: string }>
  scores: ScoreRecord
  hero: HeroMetric
  streak?: StreakState
  todayCorrect: number
  letterAccuracy?: LetterAccuracyRecord
  courseProgress?: CourseProgress | null
  onClose: () => void
  onResetScores: () => void
  onPlaySound?: (char: Letter) => void
  paddingVertical?: number
}

const SCORE_INTENSITY_MAX = 15
const CARD_VERTICAL_PADDING = 10

const formatScore = (value: number) => (value > 0 ? `+${value}` : `${value}`)

const getCodeAccessibilityText = (code: string) =>
  code
    .split('')
    .map((symbol) => {
      if (symbol === '.') {
        return 'dit'
      }
      if (symbol === '-') {
        return 'dah'
      }
      return symbol
    })
    .join(' ')

const getScoreAccessibilityText = (scoreValue: number) => {
  if (scoreValue > 0) {
    return `score plus ${scoreValue}`
  }
  if (scoreValue < 0) {
    return `score minus ${Math.abs(scoreValue)}`
  }
  return 'score zero'
}

const getScoreTint = (scoreValue: number) => {
  if (scoreValue === 0) {
    return null
  }
  const normalized = Math.abs(scoreValue) / SCORE_INTENSITY_MAX
  const intensity = Math.min(Math.max(normalized, 0.2), 1)
  const alpha = 0.35 * intensity
  const tint =
    scoreValue > 0
      ? hslaFromHsl(colors.feedback.successHsl, alpha)
      : hslaFromHsl(colors.feedback.errorHsl, alpha)
  return { borderColor: tint }
}

const formatLetterTargets = (letters: readonly string[]) =>
  letters.map((letter) => `"${letter}"`).join(' ')

function ProgressHero({ hero }: { hero: HeroMetric }) {
  if (hero.kind === 'wpm') {
    const display = hero.value > 0 ? hero.value.toFixed(1) : '—'
    return (
      <View style={styles.heroRow}>
        <Text style={styles.heroValue}>{display}</Text>
        <Text style={styles.heroLabel}>Best WPM</Text>
      </View>
    )
  }
  return (
    <View style={styles.heroRow}>
      <Text style={styles.heroValue}>
        {hero.count}
        <Text style={styles.heroValueMuted}> / {hero.total}</Text>
      </Text>
      <Text style={styles.heroLabel}>Letters mastered</Text>
    </View>
  )
}

function StreakRow({
  streak,
  todayCorrect,
  goal,
}: {
  streak?: StreakState
  todayCorrect: number
  goal: number
}) {
  const current = streak?.current ?? 0
  const filled = Math.min(todayCorrect, goal)
  const ratio = goal > 0 ? filled / goal : 0
  const streakText =
    current > 0 ? `${current}-day streak` : 'No active streak'
  const detailText =
    todayCorrect >= goal
      ? 'Today counted'
      : `${todayCorrect} / ${goal} today`
  return (
    <View style={styles.streakRow}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakText}>{streakText}</Text>
        <Text style={styles.streakDetail}>{detailText}</Text>
      </View>
      <View style={styles.streakTrack}>
        <View
          style={[
            styles.streakFill,
            { width: `${Math.round(ratio * 100)}%` },
          ]}
        />
      </View>
    </View>
  )
}

/** Progress modal with hero metric, streak, and the Morse reference grid. */
export function ReferenceModal({
  letters,
  numbers,
  morseData,
  scores,
  hero,
  streak,
  todayCorrect,
  letterAccuracy,
  courseProgress,
  onClose,
  onResetScores,
  onPlaySound,
  paddingVertical,
}: ReferenceModalProps) {
  const masteryProgress = React.useMemo(
    () => ({ scores, letterAccuracy }),
    [scores, letterAccuracy],
  )
  // Panel entrance/exit animation state
  const panelVisible = useSharedValue(0)
  const [exiting, setExiting] = React.useState(false)

  const handleResetPress = React.useCallback(() => {
    Alert.alert(
      'Reset Progress',
      'This will reset all your scores back to zero. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onResetScores },
      ],
    )
  }, [onResetScores])

  // Animate panel in on mount
  React.useEffect(() => {
    panelVisible.value = withTiming(1, { duration: 180 })
  }, [panelVisible])

  // Animate panel out on close
  const handleClose = React.useCallback(() => {
    if (exiting) return
    setExiting(true)
    panelVisible.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) scheduleOnRN(onClose)
    })
  }, [exiting, onClose, panelVisible])

  // Only animate the main panel, not the header (so header/buttons keep glass effect)
  const panelAnimStyle = useAnimatedStyle(() => ({
    opacity: panelVisible.value,
    transform: [
      { scale: 0.98 + 0.02 * panelVisible.value },
      { translateY: 16 * (1 - panelVisible.value) },
    ],
  }))
  function ReferenceCard({ char }: { char: Letter }) {
    const scoreValue = scores[char] ?? 0
    const scoreTint = getScoreTint(scoreValue)
    const mastered = isMastered(masteryProgress, char)
    const code = morseData[char].code
    const canPlaySound = typeof onPlaySound === 'function'
    const scoreStyle =
      scoreValue > 0
        ? styles.scorePositive
        : scoreValue < 0
        ? styles.scoreNegative
        : styles.scoreNeutral

    // Reanimated touch feedback
    const scale = useSharedValue(1)
    const bg = useSharedValue(0)

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }))

    const overlayStyle = useAnimatedStyle(() => ({
      ...StyleSheet.absoluteFill,
      backgroundColor: bg.value
        ? colors.surface.inputPressed
        : colors.surface.input,
      borderRadius: radii.md,
      ...(scoreTint ?? {}),
    }))

    return (
      <Animated.View
        style={[
          styles.card,
          mastered ? styles.cardMastered : null,
          animatedStyle,
          { overflow: 'hidden', borderRadius: radii.md },
        ]}
      >
        <BlurView
          intensity={26}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <Animated.View pointerEvents="none" style={overlayStyle} />
        <Pressable
          accessibilityRole={canPlaySound ? 'button' : undefined}
          accessibilityLabel={`${char}, ${getCodeAccessibilityText(
            code,
          )}, ${getScoreAccessibilityText(scoreValue)}`}
          accessibilityHint={
            canPlaySound ? `Plays the Morse sound for ${char}` : undefined
          }
          accessibilityState={{ disabled: !canPlaySound }}
          disabled={!canPlaySound}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 50, stiffness: 300 })
            bg.value = withTiming(1, { duration: 120 })
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 50, stiffness: 300 })
            bg.value = withTiming(0, { duration: 120 })
          }}
          onPress={() => {
            onPlaySound?.(char)
          }}
          style={[
            styles.cardPressable,
            {
              paddingVertical: CARD_VERTICAL_PADDING + (paddingVertical ?? 0),
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLetter}>{char}</Text>
            <Text style={[styles.cardScore, scoreStyle]}>
              {scoreValue === 0 ? '' : formatScore(scoreValue)}
            </Text>
          </View>
          <View style={styles.cardCode} accessibilityLabel={code}>
            {code.split('').map((symbol, index) => (
              <Text key={`${char}-${index}`} style={styles.cardSymbol}>
                {symbol === '.' ? '•' : symbol === '-' ? '—' : symbol}
              </Text>
            ))}
          </View>
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <View style={styles.panel}>
      <BlurView
        intensity={24}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <GlassContainer spacing={spacing.sm} style={styles.actions}>
          <DitButton
            text="Reset"
            onPress={handleResetPress}
            color={colors.feedback.error}
            style={styles.resetButton}
            accessibilityLabel="Reset scores"
          />
          <DitButton
            text="Close"
            onPress={handleClose}
            accessibilityLabel="Close reference"
          />
        </GlassContainer>
      </View>
      <Animated.View style={panelAnimStyle}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          <ProgressHero hero={hero} />
          <StreakRow
            streak={streak}
            todayCorrect={todayCorrect}
            goal={STREAK_DAILY_GOAL}
          />
          {courseProgress ? (
            <View style={styles.courseBanner}>
              <Text style={styles.courseBannerTitle}>
                Pack {courseProgress.packIndex + 1}/{courseProgress.totalPacks} · {courseProgress.phase}
              </Text>
              <Text style={styles.courseBannerLetters}>
                {formatLetterTargets(courseProgress.packLetters)}
              </Text>
            </View>
          ) : null}
          {[1, 2, 3, 4].map((level) => {
            let levelLetters = letters.filter(
              (l) => MORSE_DATA[l].level === level,
            )
            if (level === 4) {
              levelLetters = [...levelLetters, ...numbers]
            }
            if (levelLetters.length === 0) return null
            return (
              <View key={`level-${level}`} style={styles.levelSection}>
                <Text style={styles.levelSectionTitle}>Level {level}</Text>
                <GlassContainer spacing={spacing.sm} style={styles.levelCards}>
                  {levelLetters.map((char) => (
                    <ReferenceCard key={char} char={char} />
                  ))}
                </GlassContainer>
              </View>
            )
          })}
          <View style={styles.rowSpacer} />
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: 520,
    borderRadius: radii.lg,
    paddingBottom: 4,
    paddingTop: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface.panel,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: colors.shadow.base,
    shadowOpacity: 0.95,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    position: 'absolute',
    padding: spacing.lg,
    paddingBottom: 32,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    width: '100%',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    experimental_backgroundImage: colors.surface.headerGradient,
  },
  title: {
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.input,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.surface.inputPressed,
  },
  actionButtonText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.primary80,
  },
  resetButton: {
    borderColor: colors.border.error,
  },
  resetButtonText: {
    color: colors.feedback.error,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 64,
    paddingRight: spacing.md,
    paddingBottom: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: radii.lg,
  },
  rowSpacer: {
    width: '100%',
    height: spacing.sm,
  },
  scrollArea: {
    width: '100%',
    height: '100%',
  },
  card: {
    width: '30%',
    minWidth: 86,
    borderRadius: radii.md,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    // marginBottom: 12,
  },
  cardPressable: {
    width: '100%',
    paddingVertical: CARD_VERTICAL_PADDING,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardLetter: {
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.primary,
  },
  cardScore: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scorePositive: {
    color: colors.feedback.success,
  },
  scoreNegative: {
    color: colors.feedback.error,
  },
  scoreNeutral: {
    color: colors.text.primary60,
  },
  cardCode: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  cardSymbol: {
    fontSize: 14,
    letterSpacing: 1,
    color: colors.text.primary60,
  },
  levelSection: {
    width: '100%',
  },
  levelSectionTitle: {
    color: colors.text.primary60,
    fontWeight: '600',
    marginVertical: spacing.md,
    marginLeft: 2,
    letterSpacing: 1,
    fontSize: 13,
  },
  levelCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  courseBanner: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  courseBannerTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.primary40,
  },
  courseBannerLetters: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 4,
    color: colors.text.primary,
  },
  heroRow: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 1,
  },
  heroValueMuted: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.primary40,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.primary60,
  },
  streakRow: {
    width: '100%',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  streakDetail: {
    fontSize: 12,
    color: colors.text.primary60,
  },
  streakTrack: {
    width: '100%',
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.input,
    overflow: 'hidden',
  },
  streakFill: {
    height: '100%',
    backgroundColor: colors.accent.wave,
    borderRadius: radii.pill,
  },
  cardMastered: {
    borderColor: colors.border.subtle,
    borderWidth: 2,
  },
})
