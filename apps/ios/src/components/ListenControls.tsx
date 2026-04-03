import type { Letter } from '@dit/core'
import { GlassContainer } from 'expo-glass-effect'
import { StyleSheet, View } from 'react-native'
import { colors, radii, spacing } from '../design/tokens'
import { DitButton } from './DitButton'

const LISTEN_KEYBOARD_ROWS: readonly Letter[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

type ListenControlsProps = {
  availableLetters: readonly Letter[]
  listenStatus: 'idle' | 'success' | 'error'
  onReplay: () => void
  onSubmitAnswer: (value: Letter) => void
}

/** Listen mode controls with replay and an on-screen keyboard. */
export function ListenControls({
  availableLetters,
  listenStatus,
  onReplay,
  onSubmitAnswer,
}: ListenControlsProps) {
  const isIdle = listenStatus === 'idle'
  const availableLetterSet = new Set(availableLetters)

  return (
    <View style={styles.container}>
      <DitButton
        accessibilityRole="button"
        accessibilityLabel="Play morse letter sound"
        accessibilityHint="Replays the current Morse letter"
        onPress={onReplay}
        style={{
          marginBottom: spacing.md,
        }}
        textStyle={{ fontSize: 18 }}
        radius={24}
        paddingHorizontal={18}
        paddingVertical={12}
        text="Play"
        glassEffectStyle="clear"
      />
      <View style={styles.keyboard} accessible={false}>
        {LISTEN_KEYBOARD_ROWS.map((row, rowIndex) => (
          <GlassContainer
            spacing={6}
            key={`row-${rowIndex}`}
            style={styles.keyboardRow}
          >
            {row.map((key) => {
              const isAvailable = availableLetterSet.has(key)
              const isDisabled = !isIdle || !isAvailable

              return (
                <DitButton
                  key={key}
                  text={key}
                  onPress={() => onSubmitAnswer(key)}
                  accessibilityLabel={`Type ${key}`}
                  accessibilityHint={
                    !isAvailable
                      ? `${key} is not available in this pack`
                      : !isIdle
                        ? 'Wait for the next letter'
                        : `Submits the letter ${key}`
                  }
                  disabled={isDisabled}
                  style={!isAvailable ? styles.keyUnavailable : undefined}
                  size={36}
                  radius={radii.sm}
                  textStyle={isAvailable ? styles.keyText : styles.keyTextUnavailable}
                  paddingHorizontal={2}
                  paddingVertical={2}
                />
              )
            })}
          </GlassContainer>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
    marginBottom: spacing.sm,
  },
  keyboard: {
    width: '100%',
    gap: spacing.sm,
    alignItems: 'center',
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.xs,
  },
  keyUnavailable: {
    opacity: 0.28,
  },
  keyText: {
    fontSize: 18,
    color: colors.text.primary,
  },
  keyTextUnavailable: {
    fontSize: 18,
    color: colors.text.primary60,
  },
})
