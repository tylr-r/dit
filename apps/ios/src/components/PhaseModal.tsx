import { BlurView } from 'expo-blur'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'
import { ModalShell } from './ModalShell'

export type PhaseModalContent = {
  title: string
  subtitle?: string
  letters?: readonly string[]
  buttonText?: string
}

type PhaseModalProps = {
  content: PhaseModalContent
  onDismiss: () => void
}

/** Styled overlay for guided course phase transitions. */
export function PhaseModal({ content, onDismiss }: PhaseModalProps) {
  const opacity = useSharedValue(0)
  const [exiting, setExiting] = React.useState(false)

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 160 })
  }, [opacity])

  const handleDismiss = React.useCallback(() => {
    if (exiting) return
    setExiting(true)
    opacity.value = withTiming(0, { duration: 140 }, (finished) => {
      if (finished) scheduleOnRN(onDismiss)
    })
  }, [exiting, onDismiss, opacity])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.96 + 0.04 * opacity.value }],
  }))

  return (
    <ModalShell onClose={handleDismiss}>
      <Animated.View style={animStyle}>
        <View style={styles.card}>
          <BlurView
            intensity={28}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.body}>
            <Text style={styles.title}>{content.title}</Text>
            {content.subtitle ? (
              <Text style={styles.subtitle}>{content.subtitle}</Text>
            ) : null}
            {content.letters && content.letters.length > 0 ? (
              <View style={styles.letterRow}>
                {content.letters.map((letter) => (
                  <View key={letter} style={styles.letterChip}>
                    <Text style={styles.letterText}>{letter}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <DitButton
              text={content.buttonText ?? 'Continue'}
              onPress={handleDismiss}
              paddingVertical={12}
              paddingHorizontal={24}
              radius={radii.md}
              accessibilityLabel={content.buttonText ?? 'Continue'}
            />
          </View>
        </View>
      </Animated.View>
    </ModalShell>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface.panel,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: colors.shadow.base,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  body: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary70,
    textAlign: 'center',
  },
  letterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  letterChip: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.text.primary,
  },
})
