import { DitGlassSegmentedControl } from 'dit-native'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

type GlassSegmentedControlProps = {
  values: string[]
  selectedIndex: number
  onChange: (index: number) => void
  style?: StyleProp<ViewStyle>
}

/** Renders the native segmented control with the glass shell styling. */
export const GlassSegmentedControl = ({
  values,
  selectedIndex,
  onChange,
  style,
}: GlassSegmentedControlProps) => {
  const handleValueChange = (event: unknown) => {
    if (typeof event === 'number') {
      onChange(event)
      return
    }
    if (!event || typeof event !== 'object') {
      return
    }
    const typedEvent = event as {
      nativeEvent?: { value?: unknown }
      value?: unknown
    }
    const rawValue = typedEvent.nativeEvent?.value ?? typedEvent.value
    const nextIndex =
      typeof rawValue === 'number' ? rawValue : Number(rawValue)
    if (!Number.isFinite(nextIndex)) {
      return
    }
    if (nextIndex < 0 || nextIndex >= values.length) {
      return
    }
    onChange(nextIndex)
  }

  return (
    <View style={[styles.container, style]}>
      <DitGlassSegmentedControl
        style={StyleSheet.absoluteFill}
        items={values}
        selectedIndex={selectedIndex}
        onValueChange={handleValueChange}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 32, // Standard iOS segmented control height
    width: 200, // Default width
  },
})
