import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Letter } from '@dit/core';

const MAX_KEYS_PER_ROW = 10;
const KEYBOARD_GAP = 6;
const KEYBOARD_HORIZONTAL_PADDING = 12;
const MIN_KEY_SIZE = 24;

const LISTEN_KEYBOARD_ROWS: readonly Letter[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

type ListenControlsProps = {
  listenStatus: 'idle' | 'success' | 'error'
  onReplay: () => void
  onSubmitAnswer: (value: Letter) => void
}

/** Listen mode controls with replay and an on-screen keyboard. */
export function ListenControls({
  listenStatus,
  onReplay,
  onSubmitAnswer,
}: ListenControlsProps) {
  const isIdle = listenStatus === 'idle';
  const { width } = useWindowDimensions();
  const keySize = Math.max(
    MIN_KEY_SIZE,
    Math.floor(
      (width -
        KEYBOARD_HORIZONTAL_PADDING * 2 -
        KEYBOARD_GAP * (MAX_KEYS_PER_ROW - 1)) /
        MAX_KEYS_PER_ROW,
    ),
  );
  const keyRadius = Math.round(keySize / 2);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onReplay}
        accessibilityRole='button'
        accessibilityLabel='Play morse letter sound'
        disabled={!isIdle}
        style={({ pressed }) => [
          styles.playButton,
          !isIdle && styles.playButtonDisabled,
          pressed && isIdle && styles.playButtonPressed,
        ]}
      >
        <Text style={styles.playButtonText}>Play</Text>
      </Pressable>
      <View style={styles.keyboard} accessibilityRole='keyboardkey'>
        {LISTEN_KEYBOARD_ROWS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keyboardRow}>
            {row.map((key) => (
              <Pressable
                key={key}
                onPress={() => onSubmitAnswer(key)}
                accessibilityRole='button'
                accessibilityLabel={`Type ${key}`}
                disabled={!isIdle}
                style={({ pressed }) => [
                  styles.key,
                  { width: keySize, height: keySize, borderRadius: keyRadius },
                  !isIdle && styles.keyDisabled,
                  pressed && isIdle && styles.keyPressed,
                ]}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
  },
  playButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  playButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  playButtonDisabled: {
    opacity: 0.4,
  },
  playButtonText: {
    fontSize: 14,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#f4f7f9',
  },
  keyboard: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: KEYBOARD_HORIZONTAL_PADDING,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: KEYBOARD_GAP,
  },
  key: {
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  keyPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: '#f4f7f9',
  },
});
