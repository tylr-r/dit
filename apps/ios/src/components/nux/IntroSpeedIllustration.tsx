import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing as REasing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { BEZIER } from './animationTokens'
import { useReduceMotion } from './useReduceMotion'

const SIGNAL_COLOR = '#ff9d4a'
const GHOST_COLOR = 'rgba(245,245,245,0.4)'
const ARROW_COLOR = 'rgba(245,245,245,0.3)'
const LABEL_COLOR = 'rgba(245,245,245,0.4)'

const AnimatedG = Animated.createAnimatedComponent(G)

// Per-letter translateX at progress=0 (wide); all land at 0 at progress=1 (tight).
// Values chosen so the starting positions match the ghost row's x-coordinates.
const OFFSET_N = -38
const OFFSET_R = -10
const OFFSET_A = 25
const OFFSET_T = 59

/** Slide 3 illustration — wide ghost row over a tight signal row that contracts on mount. */
export function IntroSpeedIllustration() {
  const reduceMotion = useReduceMotion()
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1
      return
    }
    progress.value = withTiming(1, {
      duration: 600,
      easing: REasing.bezier(...BEZIER.out),
    })
  }, [reduceMotion, progress])

  const nProps = useAnimatedProps(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [OFFSET_N, 0]) }],
  }))
  const rProps = useAnimatedProps(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [OFFSET_R, 0]) }],
  }))
  const aProps = useAnimatedProps(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [OFFSET_A, 0]) }],
  }))
  const tProps = useAnimatedProps(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [OFFSET_T, 0]) }],
  }))

  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 276 180" width={276} height={180}>
        <SvgText x={10} y={24} fontFamily="Menlo" fontSize={9} fill={LABEL_COLOR}>
          12 / 8 WPM
        </SvgText>

        <G fill={GHOST_COLOR}>
          <Rect x={10} y={36} width={14} height={5} />
          <Rect x={27} y={36} width={4} height={5} />
          <Rect x={72} y={36} width={4} height={5} />
          <Rect x={79} y={36} width={14} height={5} />
          <Rect x={96} y={36} width={4} height={5} />
          <Rect x={148} y={36} width={4} height={5} />
          <Rect x={155} y={36} width={14} height={5} />
          <Rect x={216} y={36} width={14} height={5} />
        </G>

        <G stroke={ARROW_COLOR} strokeWidth={1} fill="none" strokeLinecap="round">
          <Line x1={138} y1={68} x2={138} y2={112} />
          <Path d="M 133 106 L 138 112 L 143 106" />
        </G>

        <AnimatedG fill={SIGNAL_COLOR} animatedProps={nProps}>
          <Rect x={48} y={136} width={14} height={5} />
          <Rect x={65} y={136} width={4} height={5} />
        </AnimatedG>
        <AnimatedG fill={SIGNAL_COLOR} animatedProps={rProps}>
          <Rect x={82} y={136} width={4} height={5} />
          <Rect x={89} y={136} width={14} height={5} />
          <Rect x={106} y={136} width={4} height={5} />
        </AnimatedG>
        <AnimatedG fill={SIGNAL_COLOR} animatedProps={aProps}>
          <Rect x={123} y={136} width={4} height={5} />
          <Rect x={130} y={136} width={14} height={5} />
        </AnimatedG>
        <AnimatedG fill={SIGNAL_COLOR} animatedProps={tProps}>
          <Rect x={157} y={136} width={14} height={5} />
        </AnimatedG>

        <SvgText x={10} y={160} fontFamily="Menlo" fontSize={9} fill={LABEL_COLOR}>
          12 / 12 WPM
        </SvgText>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
})
