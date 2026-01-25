import type { Letter, ScoreRecord } from '@dit/core';
import { MORSE_DATA } from '@dit/core';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type ReferenceModalProps = {
  letters: Letter[];
  numbers: Letter[];
  morseData: Record<Letter, { code: string }>;
  scores: ScoreRecord;
  onClose: () => void;
  onResetScores: () => void;
};

const SCORE_INTENSITY_MAX = 15;

const formatScore = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const getScoreTint = (scoreValue: number) => {
  if (scoreValue === 0) {
    return null;
  }
  const normalized = Math.abs(scoreValue) / SCORE_INTENSITY_MAX;
  const intensity = Math.min(Math.max(normalized, 0.2), 1);
  const alpha = 0.35 * intensity;
  const tint =
    scoreValue > 0
      ? `rgba(56, 242, 162, ${alpha})`
      : `rgba(255, 90, 96, ${alpha})`;
  return { borderColor: tint };
};

/** Modal panel with the Morse reference grid and scores. */
export function ReferenceModal({
  letters,
  numbers,
  morseData,
  scores,
  onClose,
  onResetScores,
}: ReferenceModalProps) {
  const renderReferenceCard = (char: Letter) => {
    const scoreValue = scores[char] ?? 0;
    const scoreTint = getScoreTint(scoreValue);
    const code = morseData[char].code;
    const scoreStyle =
      scoreValue > 0
        ? styles.scorePositive
        : scoreValue < 0
        ? styles.scoreNegative
        : styles.scoreNeutral;

    return (
      <View key={char} style={[styles.card, scoreTint]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLetter}>{char}</Text>
          <Text style={[styles.cardScore, scoreStyle]}>
            {formatScore(scoreValue)}
          </Text>
        </View>
        <View style={styles.cardCode} accessibilityLabel={code}>
          {code.split('').map((symbol, index) => (
            <Text key={`${char}-${index}`} style={styles.cardSymbol}>
              {symbol === '.' ? '•' : symbol === '-' ? '—' : symbol}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Reference</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={onResetScores}
            accessibilityRole="button"
            accessibilityLabel="Reset scores"
            style={({ pressed }) => [
              styles.actionButton,
              styles.resetButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={[styles.actionButtonText, styles.resetButtonText]}>
              Reset
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close reference"
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={styles.actionButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {[1, 2, 3, 4].map((level) => {
          let levelLetters = letters.filter(
            (l) => MORSE_DATA[l].level === level,
          );
          if (level === 4) {
            levelLetters = [...levelLetters, ...numbers];
          }
          if (levelLetters.length === 0) return null;
          return (
            <View key={`level-${level}`} style={{ width: '100%' }}>
              <Text
                style={{
                  color: '#38f2a2',
                  fontWeight: '600',
                  marginVertical: 6,
                  marginLeft: 2,
                  letterSpacing: 1,
                  fontSize: 13,
                }}
              >
                Level {level}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {levelLetters.map(renderReferenceCard)}
              </View>
            </View>
          );
        })}
        <View style={styles.rowSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: 520,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(12, 18, 24, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#f4f7f9',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  actionButtonText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.8)',
  },
  resetButton: {
    borderColor: 'rgba(255, 90, 96, 0.4)',
  },
  resetButtonText: {
    color: 'rgba(255, 90, 96, 0.95)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  rowSpacer: {
    width: '100%',
    height: 8,
  },
  scrollArea: {
    width: '100%',
    height: 420,
  },
  card: {
    width: '30%',
    minWidth: 86,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 12, 16, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardLetter: {
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#f4f7f9',
  },
  cardScore: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scorePositive: {
    color: '#38f2a2',
  },
  scoreNegative: {
    color: '#ff5a60',
  },
  scoreNeutral: {
    color: 'rgba(141, 152, 165, 0.8)',
  },
  cardCode: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  cardSymbol: {
    fontSize: 14,
    letterSpacing: 1,
    color: 'rgba(141, 152, 165, 0.9)',
  },
});
