import { StyleSheet, Text, View } from 'react-native';

export type StagePip = {
  type: 'dot' | 'dah';
  state?: 'expected' | 'hit';
};

type StageDisplayProps = {
  letter: string;
  statusText: string;
  pips: StagePip[];
  hintVisible?: boolean;
  letterPlaceholder?: boolean;
  practiceWpmText?: string | null;
  practiceWordMode?: boolean;
  practiceWord?: string | null;
  practiceWordIndex?: number;
  isFreestyle?: boolean;
};

const getFreestyleLetterStyle = (value: string) => {
  const length = Math.max(1, value.length);
  const fontSize = Math.max(48, 140 - (length - 1) * 18);
  const letterSpacing = Math.max(2, 10 - (length - 1) * 2);
  return {
    fontSize,
    lineHeight: fontSize,
    letterSpacing,
  };
};

/** Main output area for practice, freestyle, and listen states. */
export function StageDisplay({
  letter,
  statusText,
  pips,
  hintVisible = true,
  letterPlaceholder = false,
  practiceWpmText = null,
  practiceWordMode = false,
  practiceWord = null,
  practiceWordIndex = 0,
  isFreestyle = false,
}: StageDisplayProps) {
  const displayLetter = letter || '?';
  const freestyleLetterStyle = getFreestyleLetterStyle(displayLetter);

  if (isFreestyle) {
    return (
      <View style={styles.stage}>
        <Text
          style={[
            styles.letter,
            styles.freestyleLetter,
            !letter && styles.letterPlaceholder,
            freestyleLetterStyle,
          ]}
          accessibilityRole="header"
        >
          {displayLetter}
        </Text>
        <View style={[styles.progress, styles.progressHidden]} />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    );
  }

  const wordCharacters = practiceWord ? practiceWord.split('') : ['?'];

  return (
    <View style={styles.stage}>
      {practiceWordMode ? (
        <View
          style={styles.wordDisplay}
          accessibilityLabel={
            practiceWord ? `Word ${practiceWord}` : 'Practice word'
          }
        >
          {wordCharacters.map((char, index) => {
            const isDone = index < practiceWordIndex;
            const isActive = index === practiceWordIndex;
            return (
              <Text
                key={`${char}-${index}`}
                style={[
                  styles.wordLetter,
                  isDone && styles.wordLetterDone,
                  isActive && styles.wordLetterActive,
                ]}
              >
                {char}
              </Text>
            );
          })}
        </View>
      ) : (
        <Text
          style={[styles.letter, letterPlaceholder && styles.letterPlaceholder]}
          accessibilityRole="header"
        >
          {letter}
        </Text>
      )}
      {hintVisible ? (
        <View style={styles.progress}>
          {pips.map((pip, index) => (
            <View
              key={`${pip.type}-${index}`}
              style={[
                styles.pip,
                pip.type === 'dot' ? styles.pipDot : styles.pipDah,
                pip.state === 'hit' ? styles.pipHit : styles.pipExpected,
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
  );
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
    textAlign: 'center',
    paddingLeft: 8,
    paddingTop: 8,
    width: 'auto',
  },
  letterPlaceholder: {
    opacity: 0.4,
  },
  freestyleLetter: {
    marginLeft: 0,
  },
  wordDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  wordLetter: {
    fontSize: 36,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.4)',
  },
  wordLetterDone: {
    color: 'rgba(244, 247, 249, 0.85)',
  },
  wordLetterActive: {
    color: '#f4f7f9',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
    marginBottom: 12,
    width: '100%',
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
  pipExpected: {
    opacity: 0.35,
  },
  pipHit: {
    opacity: 1,
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
});
