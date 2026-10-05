import { SymbolView } from 'expo-symbols'
import { ActionSheetIOS, Pressable, StyleSheet, Text } from 'react-native'
import { normalizeColorForNative } from '../design/color'
import { colors, spacing } from '../design/tokens'

export type Mode = 'practice' | 'freestyle' | 'listen' | 'conversation'

type ModeSwitcherProps = {
  value: Mode
  onChange: (value: Mode) => void
}

const MODE_LABELS: Record<Mode, string> = {
  practice: 'Practice',
  freestyle: 'Freestyle',
  listen: 'Listen',
  conversation: 'Conversation',
}

const MODE_ORDER: Mode[] = ['practice', 'freestyle', 'listen', 'conversation']
/** A single-line mode label opening the system's native selection sheet. */
export function ModeSwitcher({ value, onChange }: ModeSwitcherProps) {
  const chooseMode = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...MODE_ORDER.map((mode) => MODE_LABELS[mode]), 'Cancel'],
        cancelButtonIndex: MODE_ORDER.length,
        userInterfaceStyle: 'dark',
      },
      (index) => {
        const mode = MODE_ORDER[index]
        if (mode) onChange(mode)
      },
    )
  }

  return (
    <Pressable
      style={styles.control}
      accessibilityRole="button"
      accessibilityLabel={`Mode: ${MODE_LABELS[value]}`}
      accessibilityHint="Choose a practice mode"
      onPress={chooseMode}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        maxFontSizeMultiplier={1.4}
        style={styles.label}
      >
        {MODE_LABELS[value]}
      </Text>
      <SymbolView
        name="chevron.down"
        size={11}
        tintColor={normalizeColorForNative(colors.text.primary60)}
        style={styles.chevron}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, maxWidth: '100%' },
  label: { fontSize: 20, fontWeight: '500', letterSpacing: -0.5, color: colors.text.primary90, flexShrink: 1 },
  chevron: { width: 11, height: 11 },
})
