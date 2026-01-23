import { StyleSheet, Text, View } from 'react-native'

export type StagePip = 'dot' | 'dah'

type StageDisplayProps = {
  letter: string
  statusText: string
  pips: StagePip[]
  hintVisible?: boolean
  practiceWpmText?: string | null
}

/** Main output area for character practice. */
export function StageDisplay({
  letter,
  statusText,
  pips,
  hintVisible = true,
  practiceWpmText = null,
}: StageDisplayProps) {
  return (
    <View style={styles.stage}>
      <Text style={styles.letter} accessibilityRole='header'>
        {letter}
      </Text>
      {hintVisible ? (
        <View style={styles.progress}>
          {pips.map((pip, index) => (
            <View
              key={`${pip}-${index}`}
              style={[
                styles.pip,
                pip === 'dot' ? styles.pipDot : styles.pipDah,
              ]}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.progress, styles.progressHidden]} />
      )}
      <Text style={styles.statusText}>{statusText}</Text>
      {practiceWpmText ? (
        <Text style={styles.wpmText}>{practiceWpmText}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 140,
    lineHeight: 140,
    letterSpacing: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    color: '#f4f7f9',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 20 },
    textShadowRadius: 60,
    marginBottom: 12,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
    marginBottom: 12,
  },
  progressHidden: {
    opacity: 0,
  },
  pip: {
    borderRadius: 999,
    backgroundColor: '#4cc9ff',
    shadowColor: 'rgba(76, 201, 255, 0.3)',
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    marginHorizontal: 6,
  },
  pipDot: {
    width: 12,
    height: 12,
  },
  pipDah: {
    width: 34,
    height: 12,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 16,
    minHeight: 18,
    letterSpacing: 2,
    color: 'rgba(141, 152, 165, 0.9)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  wpmText: {
    fontSize: 12,
    lineHeight: 14,
    minHeight: 16,
    letterSpacing: 3,
    color: 'rgba(141, 152, 165, 0.9)',
    textTransform: 'uppercase',
  },
})
