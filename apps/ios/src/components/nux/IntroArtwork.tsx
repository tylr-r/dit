import type { ReactNode } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

/** A shared, responsive illustration stage matching the web artwork's proportions. */
export function IntroArtwork({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions()
  const artWidth = Math.min(480, width - 48, (height < 700 ? 150 : 230) * 480 / 280)
  return <View style={{ width: artWidth, height: artWidth * 280 / 480 }} accessible={false}
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={[styles.canvas, {
      left: (artWidth - 480) / 2,
      top: (artWidth * 280 / 480 - 280) / 2,
      transform: [{ scale: artWidth / 480 }],
    }]}>{children}</View>
  </View>
}

const styles = StyleSheet.create({ canvas: { position: 'absolute', width: 480, height: 280 } })
