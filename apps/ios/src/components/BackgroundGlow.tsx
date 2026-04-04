import { useMemo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

/** Soft background glow layered above the liquid surface. */
export function BackgroundGlow() {
  const { width, height } = useWindowDimensions()

  const glowStops = useMemo(
    () => [
      {
        id: 'bgGlow1',
        cx: width * 0.25,
        cy: height * 0.85,
        rx: 700,
        ry: 500,
        color: { r: 168, g: 192, b: 255, a: 0.08 },
        fade: 0.6,
      },
      {
        id: 'bgGlow2',
        cx: width * 0.75,
        cy: height * 0.15,
        rx: 600,
        ry: 450,
        color: { r: 196, g: 181, b: 253, a: 0.06 },
        fade: 0.65,
      },
      {
        id: 'bgGlow3',
        cx: width * 0.5,
        cy: height * 0.5,
        rx: 500,
        ry: 400,
        color: { r: 245, g: 199, b: 247, a: 0.04 },
        fade: 0.7,
      },
    ],
    [height, width],
  )

  if (width === 0 || height === 0) {
    return null
  }

  return (
    <View pointerEvents="none" style={styles.backgroundGlow}>
      <Svg width={width} height={height}>
        <Defs>
          {glowStops.map((glow) => (
            <RadialGradient
              key={glow.id}
              id={glow.id}
              cx={glow.cx}
              cy={glow.cy}
              r={1}
              gradientUnits="userSpaceOnUse"
              gradientTransform={`translate(${glow.cx} ${glow.cy}) scale(${glow.rx} ${
                glow.ry
              }) translate(${-glow.cx} ${-glow.cy})`}
            >
              <Stop
                offset="0%"
                stopColor={`rgb(${glow.color.r}, ${glow.color.g}, ${glow.color.b})`}
                stopOpacity={glow.color.a}
              />
              <Stop
                offset={`${glow.fade * 100}%`}
                stopColor={`rgb(${glow.color.r}, ${glow.color.g}, ${glow.color.b})`}
                stopOpacity={0}
              />
              <Stop
                offset="100%"
                stopColor={`rgb(${glow.color.r}, ${glow.color.g}, ${glow.color.b})`}
                stopOpacity={0}
              />
            </RadialGradient>
          ))}
        </Defs>
        {glowStops.map((glow) => (
          <Rect key={`${glow.id}-rect`} width={width} height={height} fill={`url(#${glow.id})`} />
        ))}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  backgroundGlow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
})
