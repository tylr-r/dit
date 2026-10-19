import { useEffect } from 'react'
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { G, Path, Rect } from 'react-native-svg'
import { colors } from '../../design/tokens'
import { BEZIER } from './animationTokens'
import { IntroArtwork } from './IntroArtwork'
import { useReduceMotion } from './useReduceMotion'

const AnimatedG = Animated.createAnimatedComponent(G)

/** Listening as the learning action, with no visual Morse pattern to decode. */
export function IntroListenIllustration() {
  const reduceMotion = useReduceMotion()
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = reduceMotion ? 1 : withRepeat(withSequence(
      withTiming(0.45, { duration: 1600, easing: Easing.bezier(...BEZIER.inOut) }),
      withTiming(1, { duration: 1600, easing: Easing.bezier(...BEZIER.inOut) }),
    ), 2)
    return () => cancelAnimation(opacity)
  }, [reduceMotion, opacity])
  const cushions = useAnimatedProps(() => ({ opacity: opacity.value }))
  return <IntroArtwork>
    <Svg viewBox="0 0 480 280" width={480} height={280}>
      <Path d="M145 167v-40a95 95 0 0 1 190 0v40" fill="none" stroke={colors.text.primary20} strokeWidth={18} strokeLinecap="round" />
      <Path d="M145 127a95 95 0 0 1 190 0" fill="none" stroke={colors.text.primary80} strokeWidth={2} />
      <Path d="M163 121a77 77 0 0 1 154 0" fill="none" stroke={colors.text.primary40} strokeWidth={5} strokeLinecap="round" />
      <G fill={colors.surface.panelStrong} stroke={colors.text.primary40} strokeWidth={1.5}>
        <Rect x={130} y={137} width={43} height={92} rx={21.5} transform="rotate(-8 151 183)" />
        <Rect x={307} y={137} width={43} height={92} rx={21.5} transform="rotate(8 329 183)" />
      </G>
      <AnimatedG animatedProps={cushions} fill={colors.accent.wave}>
        <Rect x={161} y={145} width={13} height={73} rx={6.5} transform="rotate(-8 167 181)" />
        <Rect x={306} y={145} width={13} height={73} rx={6.5} transform="rotate(8 312 181)" />
      </AnimatedG>
    </Svg>
  </IntroArtwork>
}
