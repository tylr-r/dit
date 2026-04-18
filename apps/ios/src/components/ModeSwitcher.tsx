import { Host, Picker, Text } from '@expo/ui/swift-ui'
import {
  accessibilityLabel,
  foregroundStyle,
  frame,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers'
import { GlassView } from 'expo-glass-effect'
import { StyleSheet, View } from 'react-native'
import { normalizeColorForNative } from '../design/color'
import { colors, radii, spacing } from '../design/tokens'

export type Mode = 'practice' | 'freestyle' | 'listen';

type ModeSwitcherProps = {
  value: Mode;
  onChange: (value: Mode) => void;
};

const MODE_LABELS: Record<Mode, string> = {
  practice: 'Practice',
  freestyle: 'Freestyle',
  listen: 'Listen',
}

const MODE_ORDER: Mode[] = ['practice', 'freestyle', 'listen']
const MENU_MIN_WIDTH = 132

/** Toggle between practice, freestyle, and listen modes. */
export function ModeSwitcher({ value, onChange }: ModeSwitcherProps) {
  const pickerTintColor = normalizeColorForNative(colors.controls.pickerTint)
  const pickerAccentColor = normalizeColorForNative(colors.text.primary80)

  return (
    <GlassView
      style={styles.glass}
      glassEffectStyle="regular"
      tintColor={pickerTintColor}
      isInteractive
    >
      <View style={styles.pickerWrap}>
        <Host matchContents>
          <Picker<Mode>
            label={MODE_LABELS[value]}
            selection={value}
            onSelectionChange={(next) => {
              if (next) {
                onChange(next)
              }
            }}
            modifiers={[
              accessibilityLabel('Mode'),
              frame({ minWidth: MENU_MIN_WIDTH }),
              pickerStyle('menu'),
              foregroundStyle(pickerAccentColor),
            ]}
          >
            {MODE_ORDER.map((mode) => (
              <Text key={mode} modifiers={[tag(mode)]}>
                {MODE_LABELS[mode]}
              </Text>
            ))}
          </Picker>
        </Host>
      </View>
    </GlassView>
  )
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: radii.pill,
    padding: spacing.xs,
    shadowColor: colors.shadow.base,
    shadowOpacity: 0.2,
    shadowRadius: spacing.md,
    shadowOffset: { width: 0, height: 6 },
  },
  pickerWrap: {
    alignSelf: 'center',
  },
})
