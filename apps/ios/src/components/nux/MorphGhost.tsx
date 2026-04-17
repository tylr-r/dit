import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Reanimated, {
  Easing as REasing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { colors } from '../../design/tokens'
import { BEZIER, TIMING } from './animationTokens'

export type MorphRect = {
  x: number
  y: number
  w: number
  h: number
  radius: number
}

type Props = {
  source: MorphRect | null
  target: MorphRect
  active: boolean
  /** Fires when the morph finishes — caller uses this to clear state. */
  onComplete: () => void
  reduceMotion?: boolean
}

/** Full-screen overlay that tweens a pill-shaped ghost from one rect to
 *  another. Used for the sound-check Continue → button-tutorial MorseButton
 *  transition. Values interpolate linearly over TIMING.morph with a tail fade
 *  so the ghost dissolves rather than popping. */
export function MorphGhost({
  source,
  target,
  active,
  onComplete,
  reduceMotion = false,
}: Props) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!active || !source) return
    if (reduceMotion) {
      onComplete()
      return
    }
    progress.value = 0
    progress.value = withTiming(
      1,
      {
        duration: TIMING.morph,
        easing: REasing.bezier(...BEZIER.inOut),
      },
      (finished) => {
        'worklet'
        if (finished) runOnJS(onComplete)()
      },
    )
  }, [active, source, reduceMotion, onComplete, progress])

  const ghostStyle = useAnimatedStyle(() => {
    if (!source) return { opacity: 0 }
    const p = progress.value
    const lerp = (a: number, b: number) => a + (b - a) * p
    // Hold full opacity until 82%, then fade to 0 to reveal the real target.
    const fadeStart = 0.82
    const fadeOpacity =
      p < fadeStart ? 1 : Math.max(0, 1 - (p - fadeStart) / (1 - fadeStart))
    return {
      position: 'absolute',
      left: lerp(source.x, target.x),
      top: lerp(source.y, target.y),
      width: lerp(source.w, target.w),
      height: lerp(source.h, target.h),
      borderRadius: lerp(source.radius, target.radius),
      opacity: fadeOpacity,
    }
  })

  if (!active || !source) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Reanimated.View style={[styles.pill, ghostStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.surface.panelStrong,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
})
