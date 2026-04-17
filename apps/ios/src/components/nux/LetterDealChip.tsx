import { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { colors, radii } from '../../design/tokens'
import { RSPRING } from './animationTokens'

type Props = {
  letter: string
  delay: number
  reduceMotion?: boolean
}

/** One pack chip that flips into place like a dealt card: starts rotated 90°
 *  around Y with reduced scale and no opacity, then springs flat. Under
 *  reduced motion, fades in without motion. */
export function LetterDealChip({ letter, delay, reduceMotion = false }: Props) {
  const rotateY = useSharedValue(reduceMotion ? 0 : 90)
  const scale = useSharedValue(reduceMotion ? 1 : 0.7)
  const opacity = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = withDelay(delay, withTiming(1, { duration: 240 }))
      return
    }
    opacity.value = withDelay(delay, withTiming(1, { duration: 280 }))
    rotateY.value = withDelay(delay, withSpring(0, RSPRING.soft))
    scale.value = withDelay(delay, withSpring(1, RSPRING.soft))
  }, [delay, reduceMotion, rotateY, scale, opacity])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { perspective: 600 },
      { scale: scale.value },
      { rotateY: `${rotateY.value}deg` },
    ],
  }))

  return (
    <Reanimated.View style={[styles.chip, animStyle]}>
      <Text style={styles.letter}>{letter}</Text>
    </Reanimated.View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.panelStrong,
  },
  letter: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text.primary,
  },
})
