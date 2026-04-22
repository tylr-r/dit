import { StyleSheet, View } from 'react-native'
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg'

const SIGNAL_COLOR = '#ff9d4a'
const GHOST_COLOR = 'rgba(245,245,245,0.35)'
const ARROW_COLOR = 'rgba(245,245,245,0.3)'
const LABEL_COLOR = 'rgba(245,245,245,0.4)'

const LETTERS = ['K', 'Q', 'Z', 'X', 'J']
const COUNTS = ['x4', 'x3', 'x3', 'x2', 'x1']

/** Slide 1 illustration — weakest letters translate to a mastered letter with waveform. */
export function IntroFluencyIllustration() {
  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 276 180" width={276} height={180}>
        <G>
          {LETTERS.map((letter, i) => (
            <SvgText
              key={letter}
              x={20}
              y={36 + i * 26}
              fontFamily="Menlo"
              fontSize={14}
              fill={GHOST_COLOR}
            >
              {letter}
            </SvgText>
          ))}
          {COUNTS.map((count, i) => (
            <SvgText
              key={`c-${i}`}
              x={42}
              y={36 + i * 26}
              fontFamily="Menlo"
              fontSize={8}
              fill={GHOST_COLOR}
            >
              {count}
            </SvgText>
          ))}
        </G>

        <G stroke={ARROW_COLOR} strokeWidth={1} fill="none" strokeLinecap="round">
          <Line x1={100} y1={88} x2={150} y2={88} />
          <Path d="M 144 83 L 150 88 L 144 93" />
        </G>

        <SvgText
          x={185}
          y={78}
          fontFamily="System"
          fontSize={48}
          fontWeight="600"
          fill={SIGNAL_COLOR}
        >
          K
        </SvgText>
        <Path
          d="M 178 120 L 192 120 L 192 104 L 204 104 L 204 120 L 216 120 L 216 108 L 228 108 L 228 120 L 246 120 L 246 104 L 258 104 L 258 120"
          fill="none"
          stroke={SIGNAL_COLOR}
          strokeWidth={2}
          strokeLinejoin="miter"
        />

        <SvgText x={18} y={172} fontFamily="Menlo" fontSize={9} fill={LABEL_COLOR}>
          WEAKEST
        </SvgText>
        <SvgText x={210} y={172} fontFamily="Menlo" fontSize={9} fill={LABEL_COLOR}>
          MASTERED
        </SvgText>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
})
