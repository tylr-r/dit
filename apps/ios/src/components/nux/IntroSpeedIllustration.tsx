import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { colors } from '../../design/tokens'
import { BEZIER } from './animationTokens'
import { useReduceMotion } from './useReduceMotion'
import { IntroArtwork } from './IntroArtwork'

function SpacedLetter({ letter, index, progress }: {
  letter: string; index: number; progress: ReturnType<typeof useSharedValue<number>>
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (index - 1) * 86 * (1 - progress.value) }] }))
  return <Animated.Text style={[styles.letter, { left: 144 + index * 64 }, style]}>{letter}</Animated.Text>
}

/** Whole letters retain their size as only the space between them tightens. */
export function IntroSpeedIllustration() {
  const reduceMotion = useReduceMotion()
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withDelay(960, withTiming(1, { duration: 2240, easing: Easing.bezier(...BEZIER.out) }))
    return () => cancelAnimation(progress)
  }, [reduceMotion, progress])
  const more = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.15], [1, 0], 'clamp') }))
  const less = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.15, 0.3], [0, 1], 'clamp') }))
  return <IntroArtwork>
    <View style={styles.canvas}>
      {['T', 'E', 'N'].map((letter, index) => <SpacedLetter key={letter} letter={letter} index={index} progress={progress} />)}
      <Animated.Text style={[styles.label, more]}>More space</Animated.Text>
      <Animated.Text style={[styles.label, less]}>Less space</Animated.Text>
    </View>
  </IntroArtwork>
}

const styles = StyleSheet.create({
  canvas: { width: 480, height: 280 },
  letter: { position: 'absolute', top: 101, width: 64, fontSize: 64, lineHeight: 78, fontWeight: '600', textAlign: 'center', color: colors.accent.wave },
  label: { position: 'absolute', top: 190, width: '100%', textAlign: 'center', fontSize: 20, color: colors.text.primary70 },
})
