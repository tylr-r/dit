import type { Letter } from '@dit/core'
import { GlassContainer } from 'expo-glass-effect'
import { StyleSheet, View } from 'react-native'
import { DitButton } from './DitButton'

const LISTEN_KEYBOARD_ROWS: readonly Letter[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

type ListenControlsProps = {
  listenStatus: 'idle' | 'success' | 'error';
  onReplay: () => void;
  onSubmitAnswer: (value: Letter) => void;
};

/** Listen mode controls with replay and an on-screen keyboard. */
export function ListenControls({
  listenStatus,
  onReplay,
  onSubmitAnswer,
}: ListenControlsProps) {
  const isIdle = listenStatus === 'idle'

  return (
    <View style={styles.container}>
      <DitButton
        accessibilityRole="button"
        accessibilityLabel="Play morse letter sound"
        onPress={onReplay}
        style={{
          marginBottom: 12,
        }}
        textStyle={{ fontSize: 18 }}
        radius={24}
        paddingHorizontal={18}
        paddingVertical={12}
        text="Play"
        glassEffectStyle="clear"
      />
      <View style={styles.keyboard} accessibilityRole="keyboardkey">
        {LISTEN_KEYBOARD_ROWS.map((row, rowIndex) => (
          <GlassContainer
            spacing={6}
            key={`row-${rowIndex}`}
            style={styles.keyboardRow}
          >
            {row.map((key) => (
              <DitButton
                key={key}
                text={key}
                onPress={isIdle ? () => onSubmitAnswer(key) : () => {}}
                accessibilityLabel={`Type ${key}`}
                size={36}
                radius={8}
                textStyle={styles.keyText}
                paddingHorizontal={2}
                paddingVertical={2}
              />
            ))}
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
    marginBottom: 8,
  },
  keyboard: {
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 4,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyText: {
    fontSize: 18,
    color: '#f4f7f9',
  },
})
