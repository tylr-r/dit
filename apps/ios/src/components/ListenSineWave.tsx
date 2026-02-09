import { useEffect } from 'react'
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { hslaFromHsl } from '../design/color'
import { colors } from '../design/tokens'
import {
  type ListenWavePlayback,
} from '../utils/listenWave'

type ListenWaveTintStatus = 'idle' | 'success' | 'error'

type ListenSineWaveProps = {
  playback: ListenWavePlayback | null;
  tintStatus?: ListenWaveTintStatus;
  liveActive?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPath = Animated.createAnimatedComponent(Path)
const TWO_PI = Math.PI * 2
const SAMPLE_POINTS = 80
const IDLE_ENERGY = 0.12
const ACTIVE_ENERGY = 1
const BASE_PHASE_SPEED = 0.95
const ACTIVE_PHASE_SPEED_BONUS = 2.4
const WAVE_CYCLES = 1.85
const LOWER_BAND_OFFSET_SCALE = 0
const UPPER_BAND_OFFSET_SCALE = 0
const SUCCESS_COLOR = colors.feedback.success
const ERROR_COLOR = colors.feedback.error
const TINT_FADE_IN_MS = 420
const TINT_FADE_OUT_MS = 280

const LINE_SPECS = [
  {
    stroke: hslaFromHsl(colors.feedback.successHsl, 0.35),
    strokeWidth: 1.9,
    phaseOffset: -0.9,
    amplitudeScale: 0.74,
    laneOffsetScale: -0.03,
  },
  {
    stroke: colors.accent.wave,
    strokeWidth: 2.8,
    phaseOffset: 0,
    amplitudeScale: 1,
    laneOffsetScale: 0,
  },
  {
    stroke: colors.text.primary40,
    strokeWidth: 1.9,
    phaseOffset: 0.9,
    amplitudeScale: 0.74,
    laneOffsetScale: 0.03,
  },
] as const

const getToneLevelAtElapsedMsWorklet = (
  symbolsCode: string,
  unitMs: number,
  elapsedMs: number,
  interCharacterGapMs: number,
) => {
  'worklet'

  if (unitMs <= 0 || elapsedMs < 0) {
    return 0
  }

  if (symbolsCode.length === 0) {
    return 0
  }

  let cursorMs = 0
  for (let symbolIndex = 0; symbolIndex < symbolsCode.length; symbolIndex += 1) {
    const symbol = symbolsCode[symbolIndex]
    const toneMs = symbol === '.' ? unitMs : unitMs * 3
    if (elapsedMs < cursorMs + toneMs) {
      return symbol === '.' ? 0.72 : 1
    }
    cursorMs += toneMs

    if (symbolIndex < symbolsCode.length - 1) {
      if (elapsedMs < cursorMs + unitMs) {
        return 0
      }
      cursorMs += unitMs
    } else if (elapsedMs < cursorMs + interCharacterGapMs) {
      return 0
    }
  }

  return 0
}

const createPath = (
  width: number,
  height: number,
  phase: number,
  energy: number,
  bandOffsetScale: number,
  laneOffsetScale: number,
  amplitudeScale: number,
  phaseOffset: number,
  direction: -1 | 1,
  invertHeight: boolean,
) => {
  'worklet'

  if (width <= 0 || height <= 0) {
    return 'M 0 0'
  }

  const midY = height * 0.5
  const maxAmplitude = height * 0.165
  const idleAmplitude = height * 0.028
  const amplitude = (idleAmplitude + maxAmplitude * energy) * amplitudeScale
  const baseline = midY + height * (bandOffsetScale + laneOffsetScale)
  const invert = invertHeight ? -1 : 1

  let path = ''
  for (let index = 0; index <= SAMPLE_POINTS; index += 1) {
    const t = index / SAMPLE_POINTS
    const x = width * t
    const edgeWeight = 0.52 + Math.sin(Math.PI * t) * 0.48
    const travelPhase =
      t * WAVE_CYCLES * TWO_PI + phaseOffset + phase * direction
    const oscillation = Math.sin(travelPhase)
    const y = baseline + invert * oscillation * amplitude * edgeWeight
    path += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
  }

  return path
}

/** Symmetric listen-mode wave that reacts to Morse playback timing. */
export function ListenSineWave({
  playback,
  tintStatus = 'idle',
  liveActive = false,
  style,
}: ListenSineWaveProps) {
  const width = useSharedValue(0)
  const height = useSharedValue(0)
  const phase = useSharedValue(0)
  const energy = useSharedValue(IDLE_ENERGY)
  const tintOpacity = useSharedValue(0)
  const liveLevel = useSharedValue(0)
  const elapsedMs = useSharedValue(0)
  const symbolsCode = useSharedValue('')
  const unitMs = useSharedValue(40)
  const interCharacterGapMs = useSharedValue(120)

  useEffect(() => {
    if (!playback) {
      symbolsCode.value = ''
      unitMs.value = 40
      interCharacterGapMs.value = 120
      elapsedMs.value = 0
      return
    }
    symbolsCode.value = playback.code
      .split('')
      .filter((symbol) => symbol === '.' || symbol === '-')
      .join('')
    unitMs.value = playback.unitMs
    interCharacterGapMs.value = playback.interCharacterGapMs
    elapsedMs.value = 0
  }, [
    playback,
    symbolsCode,
    elapsedMs,
    interCharacterGapMs,
    unitMs,
  ])

  useEffect(() => {
    const targetOpacity = tintStatus === 'idle' ? 0 : 0.7
    tintOpacity.value = withTiming(targetOpacity, {
      duration: tintStatus === 'idle' ? TINT_FADE_OUT_MS : TINT_FADE_IN_MS,
      easing:
        tintStatus === 'idle'
          ? Easing.in(Easing.quad)
          : Easing.out(Easing.cubic),
    })
  }, [tintOpacity, tintStatus])

  useEffect(() => {
    liveLevel.value = withTiming(liveActive ? 1 : 0, {
      duration: liveActive ? 90 : 140,
      easing: liveActive ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
    })
  }, [liveActive, liveLevel])

  useFrameCallback((frameInfo) => {
    const deltaMs = frameInfo.timeSincePreviousFrame
    if (deltaMs === null) {
      return
    }

    elapsedMs.value += deltaMs
    const toneLevel = getToneLevelAtElapsedMsWorklet(
      symbolsCode.value,
      unitMs.value,
      elapsedMs.value,
      interCharacterGapMs.value,
    )
    const effectiveToneLevel = Math.max(toneLevel, liveLevel.value)
    const targetEnergy =
      IDLE_ENERGY + effectiveToneLevel * (ACTIVE_ENERGY - IDLE_ENERGY)
    const attackBlend = 1 - Math.exp(-deltaMs / 62)
    const decayBlend = 1 - Math.exp(-deltaMs / 190)
    const blend = targetEnergy > energy.value ? attackBlend : decayBlend
    energy.value += (targetEnergy - energy.value) * blend

    const phaseSpeed = BASE_PHASE_SPEED + energy.value * ACTIVE_PHASE_SPEED_BONUS
    phase.value = (phase.value + (deltaMs / 1000) * phaseSpeed) % TWO_PI
  })

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout
    width.value = nextWidth
    height.value = nextHeight
  }

  const tintLayerStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value,
  }))

  const tintStroke = tintStatus === 'error' ? ERROR_COLOR : SUCCESS_COLOR

  const firstLineProps = useAnimatedProps(() => ({
    d: createPath(
      width.value,
      height.value,
      phase.value + LINE_SPECS[0].phaseOffset,
      energy.value,
      LOWER_BAND_OFFSET_SCALE,
      LINE_SPECS[0].laneOffsetScale,
      LINE_SPECS[0].amplitudeScale,
      LINE_SPECS[0].phaseOffset,
      -1,
      false,
    ),
  }))

  const secondLineProps = useAnimatedProps(() => ({
    d: createPath(
      width.value,
      height.value,
      phase.value + LINE_SPECS[1].phaseOffset,
      energy.value,
      LOWER_BAND_OFFSET_SCALE,
      LINE_SPECS[1].laneOffsetScale,
      LINE_SPECS[1].amplitudeScale,
      LINE_SPECS[1].phaseOffset,
      -1,
      false,
    ),
  }))

  const thirdLineProps = useAnimatedProps(() => ({
    d: createPath(
      width.value,
      height.value,
      phase.value + LINE_SPECS[2].phaseOffset,
      energy.value,
      LOWER_BAND_OFFSET_SCALE,
      LINE_SPECS[2].laneOffsetScale,
      LINE_SPECS[2].amplitudeScale,
      LINE_SPECS[2].phaseOffset,
      -1,
      false,
    ),
  }))

  const firstLineInverseProps = useAnimatedProps(() => ({
    d: createPath(
      width.value,
      height.value,
      phase.value + LINE_SPECS[0].phaseOffset,
      energy.value,
      UPPER_BAND_OFFSET_SCALE,
      LINE_SPECS[0].laneOffsetScale,
      LINE_SPECS[0].amplitudeScale,
      LINE_SPECS[0].phaseOffset,
      1,
      true,
    ),
  }))

  const secondLineInverseProps = useAnimatedProps(() => ({
    d: createPath(
      width.value,
      height.value,
      phase.value + LINE_SPECS[1].phaseOffset,
      energy.value,
      UPPER_BAND_OFFSET_SCALE,
      LINE_SPECS[1].laneOffsetScale,
      LINE_SPECS[1].amplitudeScale,
      LINE_SPECS[1].phaseOffset,
      1,
      true,
    ),
  }))

  const thirdLineInverseProps = useAnimatedProps(() => ({
    d: createPath(
      width.value,
      height.value,
      phase.value + LINE_SPECS[2].phaseOffset,
      energy.value,
      UPPER_BAND_OFFSET_SCALE,
      LINE_SPECS[2].laneOffsetScale,
      LINE_SPECS[2].amplitudeScale,
      LINE_SPECS[2].phaseOffset,
      1,
      true,
    ),
  }))

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <Svg width="100%" height="100%">
        <AnimatedPath
          animatedProps={firstLineInverseProps}
          fill="none"
          stroke={LINE_SPECS[0].stroke}
          strokeWidth={LINE_SPECS[0].strokeWidth}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={secondLineInverseProps}
          fill="none"
          stroke={LINE_SPECS[1].stroke}
          strokeWidth={LINE_SPECS[1].strokeWidth}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={thirdLineInverseProps}
          fill="none"
          stroke={LINE_SPECS[2].stroke}
          strokeWidth={LINE_SPECS[2].strokeWidth}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={firstLineProps}
          fill="none"
          stroke={LINE_SPECS[0].stroke}
          strokeWidth={LINE_SPECS[0].strokeWidth}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={secondLineProps}
          fill="none"
          stroke={LINE_SPECS[1].stroke}
          strokeWidth={LINE_SPECS[1].strokeWidth}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={thirdLineProps}
          fill="none"
          stroke={LINE_SPECS[2].stroke}
          strokeWidth={LINE_SPECS[2].strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.tintLayer, tintLayerStyle]}>
        <Svg width="100%" height="100%">
          <AnimatedPath
            animatedProps={firstLineInverseProps}
            fill="none"
            stroke={tintStroke}
            strokeWidth={LINE_SPECS[0].strokeWidth}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={secondLineInverseProps}
            fill="none"
            stroke={tintStroke}
            strokeWidth={LINE_SPECS[1].strokeWidth}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={thirdLineInverseProps}
            fill="none"
            stroke={tintStroke}
            strokeWidth={LINE_SPECS[2].strokeWidth}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={firstLineProps}
            fill="none"
            stroke={tintStroke}
            strokeWidth={LINE_SPECS[0].strokeWidth}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={secondLineProps}
            fill="none"
            stroke={tintStroke}
            strokeWidth={LINE_SPECS[1].strokeWidth}
            strokeLinecap="round"
          />
          <AnimatedPath
            animatedProps={thirdLineProps}
            fill="none"
            stroke={tintStroke}
            strokeWidth={LINE_SPECS[2].strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  tintLayer: {
    ...StyleSheet.absoluteFillObject,
  },
})
