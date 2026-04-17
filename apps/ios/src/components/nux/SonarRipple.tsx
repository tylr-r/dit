import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Reanimated, {
  Easing as REasing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { BEZIER, TIMING } from './animationTokens'

type Props = {
  /** Diameter of the element this ripple centers on. */
  size: number
  /** Border color of the expanding ring. */
  color: string
  /** When true, rings expand in a loop. Set false to fade them out. */
  active: boolean
  reduceMotion?: boolean
}

/** Two expanding rings that emanate from the center of a circular element —
 *  reads as "I'm listening" or "tone is playing". Loops while active. */
export function SonarRipple({ size, color, active, reduceMotion = false }: Props) {
  const ring1Scale = useSharedValue(1)
  const ring1Opacity = useSharedValue(0)
  const ring2Scale = useSharedValue(1)
  const ring2Opacity = useSharedValue(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelAnimation(ring1Scale)
      cancelAnimation(ring1Opacity)
      cancelAnimation(ring2Scale)
      cancelAnimation(ring2Opacity)
    }
  }, [ring1Scale, ring1Opacity, ring2Scale, ring2Opacity])

  useEffect(() => {
    if (!active || reduceMotion) {
      ring1Opacity.value = withTiming(0, { duration: 200 })
      ring2Opacity.value = withTiming(0, { duration: 200 })
      return
    }

    const runRing = (
      scale: typeof ring1Scale,
      opacity: typeof ring1Opacity,
      delay: number,
    ) => {
      scale.value = 1
      opacity.value = 0
      scale.value = withDelay(
        delay,
        withRepeat(
          withTiming(2.4, {
            duration: TIMING.ripple,
            easing: REasing.bezier(...BEZIER.out),
          }),
          -1,
          false,
        ),
      )
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.5, { duration: 80 }),
            withTiming(0, {
              duration: TIMING.ripple - 80,
              easing: REasing.bezier(...BEZIER.out),
            }),
          ),
          -1,
          false,
        ),
      )
    }

    runRing(ring1Scale, ring1Opacity, 0)
    runRing(ring2Scale, ring2Opacity, 500)
  }, [active, reduceMotion, ring1Scale, ring1Opacity, ring2Scale, ring2Opacity])

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }))
  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }))

  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: color,
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <Reanimated.View style={[styles.ring, ring, ring1Style]} />
      <Reanimated.View style={[styles.ring, ring, ring2Style]} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
})
