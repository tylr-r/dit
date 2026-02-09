import type { Letter, ScoreRecord } from '@dit/core'
import { MORSE_DATA } from '@dit/core'
import { BlurView } from 'expo-blur'
import { GlassContainer } from 'expo-glass-effect'
import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
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

type ReferenceModalProps = {
  letters: Letter[];
  numbers: Letter[];
  morseData: Record<Letter, { code: string }>;
  scores: ScoreRecord;
  onClose: () => void;
  onResetScores: () => void;
  onPlaySound?: (char: Letter) => void;
  paddingVertical?: number;
};

const SCORE_INTENSITY_MAX = 15

const formatScore = (value: number) => (value > 0 ? `+${value}` : `${value}`)

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

/** Modal panel with the Morse reference grid and scores. */
export function ReferenceModal({
  letters,
  numbers,
  morseData,
  scores,
  onClose,
  onResetScores,
  onPlaySound,
  paddingVertical,
}: ReferenceModalProps) {
  // Panel entrance/exit animation state
  const panelVisible = useSharedValue(0)
  const [exiting, setExiting] = React.useState(false)

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
    const code = morseData[char].code
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
      ...StyleSheet.absoluteFillObject,
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
          animatedStyle,
          { overflow: 'hidden', borderRadius: radii.md },
        ]}
      >
        <BlurView
          intensity={26}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View style={overlayStyle} />
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Play sound for ${char}`}
          onTouchStart={() => {
            scale.value = withSpring(0.97, { damping: 50, stiffness: 300 })
            bg.value = withTiming(1, { duration: 120 })
          }}
          onTouchEnd={() => {
            scale.value = withSpring(1, { damping: 50, stiffness: 300 })
            bg.value = withTiming(0, { duration: 120 })
            onPlaySound?.(char)
          }}
          style={{
            borderRadius: radii.md,
            paddingVertical: paddingVertical ?? 0,
          }}
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
        </View>
      </Animated.View>
    )
  }

  return (
    <View style={styles.panel}>
      <BlurView
        intensity={24}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.header}>
        <Text style={styles.title}>Reference</Text>
        <GlassContainer spacing={spacing.sm} style={styles.actions}>
          <DitButton
            text="Reset"
            onPress={onResetScores}
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
                <Text style={styles.levelSectionTitle}>
                  Level {level}
                </Text>
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
    experimental_backgroundImage:
      colors.surface.headerGradient,
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
    gap: 4,
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
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    // marginBottom: 12,
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
})
