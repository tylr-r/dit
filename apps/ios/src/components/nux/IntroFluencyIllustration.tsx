import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { normalizeColorForNative } from '../../design/color'
import { colors } from '../../design/tokens'
import { IntroArtwork } from './IntroArtwork'
import { useReduceMotion } from './useReduceMotion'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const sequence = ['N', 'R', 'A', 'T', 'E']
const letters = Array.from({ length: 12 }, (_, index) => sequence[(index + 2) % 5])
const slots = [
  { x: -30, scale: 0.32, opacity: 0 }, { x: 48, scale: 0.32, opacity: 0.2 },
  { x: 126, scale: 0.43, opacity: 0.4 }, { x: 240, scale: 1, opacity: 1 },
  { x: 354, scale: 0.43, opacity: 0.4 }, { x: 432, scale: 0.32, opacity: 0.2 },
  { x: 510, scale: 0.32, opacity: 0 },
]
const ink = normalizeColorForNative(colors.text.primary)
const accent = normalizeColorForNative(colors.accent.wave)

function RecognitionLetter({ index, phase }: { index: number; phase: ReturnType<typeof useSharedValue<number>> }) {
  const style = useAnimatedStyle(() => {
    const step = Math.floor(phase.value)
    const transition = Math.max(0, (phase.value - step - 0.8) * 5)
    const progress = 1 - Math.pow(1 - transition, 3)
    const from = slots[Math.max(0, Math.min(6, index - step))]
    const to = slots[Math.max(0, Math.min(6, index - step - 1))]
    const scale = from.scale + (to.scale - from.scale) * progress
    return {
      opacity: from.opacity + (to.opacity - from.opacity) * progress,
      color: interpolateColor(scale, [0.43, 1], [ink, accent]),
      transform: [{ translateX: from.x + (to.x - from.x) * progress - 74 }, { scale }],
    }
  })
  return <Animated.Text style={[styles.letter, style]}>{letters[index]}</Animated.Text>
}

/** A continuous whole-character recognition preview with no encoded answers. */
export function IntroFluencyIllustration() {
  const reduceMotion = useReduceMotion()
  const phase = useSharedValue(0)
  useEffect(() => {
    phase.value = reduceMotion ? 0 : withRepeat(withTiming(5, { duration: 12000, easing: Easing.linear }), -1)
    return () => cancelAnimation(phase)
  }, [reduceMotion, phase])
  const check = useAnimatedProps(() => {
    const local = phase.value % 1
    const draw = Math.max(0, Math.min(1, (local - 0.3) / (160 / 2400)))
    return { opacity: reduceMotion ? 1 : Math.floor(phase.value) === 1 || local > 0.75 ? 0 : draw, strokeDashoffset: reduceMotion ? 0 : 40 * (1 - draw) }
  })
  const miss = useAnimatedProps(() => {
    const local = phase.value % 1
    const draw = Math.max(0, Math.min(1, (local - 0.3) / (160 / 2400)))
    return { opacity: !reduceMotion && Math.floor(phase.value) === 1 && local <= 0.75 ? draw : 0, strokeDashoffset: 46 * (1 - draw) }
  })
  return <IntroArtwork>
    {letters.map((_, index) => <RecognitionLetter key={index} index={index} phase={phase} />)}
    <Svg viewBox="0 0 480 280" width={480} height={280} style={StyleSheet.absoluteFill}>
      <AnimatedPath animatedProps={check} d="m229 234 8 8 15-17" fill="none" stroke={colors.feedback.success} strokeWidth={3} strokeDasharray={40} strokeLinecap="round" strokeLinejoin="round" />
      <AnimatedPath animatedProps={miss} d="m232 226 16 16m0-16-16 16" fill="none" stroke={colors.feedback.error} strokeWidth={3} strokeDasharray={46} strokeLinecap="round" />
    </Svg>
  </IntroArtwork>
}

const styles = StyleSheet.create({ letter: { position: 'absolute', top: 46, width: 148, fontSize: 148, lineHeight: 168, textAlign: 'center', fontWeight: '600' } })
