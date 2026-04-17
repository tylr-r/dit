import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Reanimated, {
  Easing as REasing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { BEZIER, TIMING } from './animationTokens'

type Props = {
  /** When true, render static gradient with no motion. */
  reduceMotion?: boolean
}

/** Slow-drifting radial gradient that sits behind the welcome logo. Two warm
 *  lobes breathe in/out of phase, producing a subtle aurora feel without
 *  drawing attention away from the logo. */
export function AuroraGlow({ reduceMotion = false }: Props) {
  const { width, height } = useWindowDimensions()
  const drift = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0.5
      return
    }
    drift.value = withRepeat(
      withTiming(1, {
        duration: TIMING.aurora,
        easing: REasing.bezier(...BEZIER.inOut),
      }),
      -1,
      true,
    )
    return () => cancelAnimation(drift)
  }, [reduceMotion, drift])

  const warmStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + drift.value * 0.3,
    transform: [
      { translateX: (drift.value - 0.5) * 40 },
      { translateY: (0.5 - drift.value) * 24 },
      { scale: 1 + drift.value * 0.08 },
    ],
  }))

  const coolStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + (1 - drift.value) * 0.3,
    transform: [
      { translateX: (0.5 - drift.value) * 36 },
      { translateY: (drift.value - 0.5) * 28 },
      { scale: 1 + (1 - drift.value) * 0.1 },
    ],
  }))

  if (width === 0 || height === 0) return null

  return (
    <>
      <Reanimated.View pointerEvents="none" style={[styles.fill, warmStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient
              id="auroraWarm"
              cx={width * 0.35}
              cy={height * 0.4}
              r={Math.max(width, height) * 0.55}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="hsl(24, 100%, 62%)" stopOpacity={0.22} />
              <Stop offset="55%" stopColor="hsl(24, 100%, 62%)" stopOpacity={0.04} />
              <Stop offset="100%" stopColor="hsl(24, 100%, 62%)" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#auroraWarm)" />
        </Svg>
      </Reanimated.View>
      <Reanimated.View pointerEvents="none" style={[styles.fill, coolStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient
              id="auroraCool"
              cx={width * 0.7}
              cy={height * 0.65}
              r={Math.max(width, height) * 0.5}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="hsl(207, 85%, 58%)" stopOpacity={0.18} />
              <Stop offset="60%" stopColor="hsl(207, 85%, 58%)" stopOpacity={0.03} />
              <Stop offset="100%" stopColor="hsl(207, 85%, 58%)" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#auroraCool)" />
        </Svg>
      </Reanimated.View>
    </>
  )
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
})
