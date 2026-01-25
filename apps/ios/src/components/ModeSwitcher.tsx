import { Host, Picker } from '@expo/ui/swift-ui'
import { accessibilityLabel, frame } from '@expo/ui/swift-ui/modifiers'
import { GlassView } from 'expo-glass-effect'
import { StyleSheet, View } from 'react-native'

export type Mode = 'practice' | 'freestyle' | 'listen'

type ModeSwitcherProps = {
  value: Mode
  onChange: (value: Mode) => void
}

const MODE_LABELS: Record<Mode, string> = {
  practice: 'Practice',
  freestyle: 'Freestyle',
  listen: 'Listen',
}

const MODE_ORDER: Mode[] = ['practice', 'freestyle', 'listen']
const MENU_MIN_WIDTH = 132

/** Toggle between practice, freestyle, and listen modes. */
export function ModeSwitcher({ value, onChange }: ModeSwitcherProps) {
  const selectedIndex = MODE_ORDER.indexOf(value)

  return (
    <GlassView
      style={styles.glass}
      glassEffectStyle='regular'
      tintColor='rgba(0, 0, 0, 0.5)'
      isInteractive
    >
      <View style={styles.pickerWrap}>
        <Host matchContents>
          <Picker
            options={MODE_ORDER.map((mode) => MODE_LABELS[mode])}
            selectedIndex={selectedIndex}
            label={MODE_LABELS[value]}
            modifiers={[accessibilityLabel('Mode'), frame({ minWidth: MENU_MIN_WIDTH })]}
            onOptionSelected={({ nativeEvent }) => {
              const nextMode = MODE_ORDER[nativeEvent.index]
              if (nextMode) {
                onChange(nextMode)
              }
            }}
            variant='menu'
          />
        </Host>
      </View>
    </GlassView>
  )
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: 999,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pickerWrap: {
    alignSelf: 'center',
  },
})
