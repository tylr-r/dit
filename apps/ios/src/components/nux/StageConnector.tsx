import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Reanimated, {
  Easing as REasing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { colors } from '../../design/tokens'
import { BEZIER, TIMING } from './animationTokens'

type Props = {
  /** Triggers the draw once set true. Remains drawn afterward. */
  active: boolean
  /** Sequencing offset when multiple connectors are driven by the same flag. */
  delay?: number
  reduceMotion?: boolean
}

/** Thin vertical line that draws top-down between stage cards. Rendered in the
 *  gap between cards so it doesn't need to run through (and clip against) the
 *  circled numbers. */
export function StageConnector({ active, delay = 0, reduceMotion = false }: Props) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!active) {
      progress.value = 0
      return
    }
    if (reduceMotion) {
      progress.value = 1
      return
    }
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: TIMING.connector,
        easing: REasing.bezier(...BEZIER.inOut),
      }),
    )
  }, [active, delay, reduceMotion, progress])

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
  }))

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Reanimated.View style={[styles.line, lineStyle]} />
    </View>
  )
}

const WRAP_HEIGHT = 44
const LINE_INSET = 8
const LINE_HEIGHT = WRAP_HEIGHT - LINE_INSET * 2

const styles = StyleSheet.create({
  wrap: {
    height: WRAP_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: LINE_INSET,
  },
  line: {
    width: 1,
    height: LINE_HEIGHT,
    backgroundColor: colors.text.primary20,
    transformOrigin: 'top',
  },
})
