import { StyleSheet, View } from 'react-native'
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg'

const SIGNAL_COLOR = '#ff9d4a'
const GHOST_OPACITY = 0.4
const ARROW_COLOR = 'rgba(245,245,245,0.3)'
const LABEL_COLOR = 'rgba(245,245,245,0.4)'
const TEXT_COLOR = '#f5f5f5'

const CHART_ROWS = [
  { letter: 'A', pattern: '· —' },
  { letter: 'N', pattern: '— ·' },
  { letter: 'R', pattern: '· — ·' },
  { letter: 'T', pattern: '—' },
  { letter: 'E', pattern: '·' },
]

/** Slide 2 illustration — chart table dissolves into a flowing waveform. */
export function IntroListenIllustration() {
  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 276 180" width={276} height={180}>
        <G opacity={GHOST_OPACITY}>
          {CHART_ROWS.map((row, i) => (
            <SvgText
              key={row.letter}
              x={12}
              y={40 + i * 22}
              fontFamily="Menlo"
              fontSize={10}
              fill={TEXT_COLOR}
            >
              {row.letter}  {row.pattern}
            </SvgText>
          ))}
        </G>

        <G stroke={ARROW_COLOR} strokeWidth={1} fill="none" strokeLinecap="round">
          <Line x1={100} y1={85} x2={150} y2={85} />
          <Path d="M 144 80 L 150 85 L 144 90" />
        </G>

        <Path
          d="M 160 85 Q 170 85 170 60 Q 170 85 182 85 Q 196 85 196 40 Q 196 85 210 85 Q 222 85 222 115 Q 222 85 236 85 Q 250 85 250 60 Q 250 85 264 85"
          fill="none"
          stroke={SIGNAL_COLOR}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <SvgText x={12} y={170} fontFamily="Menlo" fontSize={9} fill={LABEL_COLOR}>
          DECODE
        </SvgText>
        <SvgText x={210} y={170} fontFamily="Menlo" fontSize={9} fill={LABEL_COLOR}>
          HEAR
        </SvgText>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
})
