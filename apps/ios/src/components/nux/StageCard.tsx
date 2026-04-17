import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../../design/tokens'
import { EASE, TIMING } from './animationTokens'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = 24
const STROKE = 1
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Props = {
  number: 1 | 2 | 3
  title: string
  description: string
  /** Delay before the circle starts drawing, aligned with the card's stagger. */
  drawDelay: number
  reduceMotion: boolean
}

/** One stage row for the beginner_stages step. The number appears first,
 *  then a ring draws around it from 12 o'clock — reads as "stage complete,
 *  next stage ready". Number color brightens as the ring closes. */
export function StageCard({
  number,
  title,
  description,
  drawDelay,
  reduceMotion,
}: Props) {
  const dashOffset = useRef(
    new Animated.Value(reduceMotion ? 0 : CIRCUMFERENCE),
  ).current
  const colorAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) return
    const anim = Animated.parallel([
      Animated.timing(dashOffset, {
        toValue: 0,
        duration: TIMING.circleDraw,
        delay: drawDelay,
        easing: EASE.out,
        useNativeDriver: false,
      }),
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: TIMING.circleDraw,
        delay: drawDelay,
        easing: EASE.out,
        useNativeDriver: false,
      }),
    ])
    anim.start()
    return () => anim.stop()
  }, [dashOffset, colorAnim, drawDelay, reduceMotion])

  const numberColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text.primary20, colors.text.primary80],
  })

  return (
    <View style={styles.container}>
      <View style={styles.circleWrap}>
        <Svg width={SIZE} height={SIZE}>
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.text.primary40}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset as unknown as number}
            fill="transparent"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Animated.Text style={[styles.number, { color: numberColor }]}>
          {number}
        </Animated.Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  circleWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  number: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary60,
    textAlign: 'center',
  },
})
