import type { Letter, ScoreRecord } from '@dit/core';
import { MORSE_DATA } from '@dit/core';
import { BlurView } from 'expo-blur';
import { GlassContainer } from 'expo-glass-effect';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { TextButton } from './TextButton';

type ReferenceModalProps = {
  letters: Letter[];
  numbers: Letter[];
  morseData: Record<Letter, { code: string }>;
  scores: ScoreRecord;
  onClose: () => void;
  onResetScores: () => void;
  onPlaySound?: (char: Letter) => void;
  paddingVertical?: number;
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
  onPlaySound,
  paddingVertical,
}: ReferenceModalProps) {
  // Panel entrance/exit animation state
  const panelVisible = useSharedValue(0);
  const [exiting, setExiting] = React.useState(false);

  // Animate panel in on mount
  React.useEffect(() => {
    panelVisible.value = withTiming(1, { duration: 180 });
  }, [panelVisible]);

  // Animate panel out on close
  const handleClose = React.useCallback(() => {
    if (exiting) return;
    setExiting(true);
    panelVisible.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) scheduleOnRN(onClose);
    });
  }, [exiting, onClose, panelVisible]);

  // Only animate the main panel, not the header (so header/buttons keep glass effect)
  const panelAnimStyle = useAnimatedStyle(() => ({
    opacity: panelVisible.value,
    transform: [
      { scale: 0.98 + 0.02 * panelVisible.value },
      { translateY: 16 * (1 - panelVisible.value) },
    ],
  }));
  function ReferenceCard({ char }: { char: Letter }) {
    const scoreValue = scores[char] ?? 0;
    const scoreTint = getScoreTint(scoreValue);
    const code = morseData[char].code;
    const scoreStyle =
      scoreValue > 0
        ? styles.scorePositive
        : scoreValue < 0
        ? styles.scoreNegative
        : styles.scoreNeutral;

    // Reanimated touch feedback
    const scale = useSharedValue(1);
    const bg = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
      ...StyleSheet.absoluteFillObject,
      backgroundColor: bg.value
        ? 'rgba(145, 145, 145, 0.33)'
        : 'hsla(210, 33%, 15%, 0.35)',
      borderRadius: 14,
      ...(scoreTint ?? {}),
    }));

    return (
      <Animated.View
        style={[
          styles.card,
          animatedStyle,
          { overflow: 'hidden', borderRadius: 14 },
        ]}
      >
        <BlurView
          intensity={26}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View style={overlayStyle} />
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Play sound for ${char}`}
          onTouchStart={() => {
            scale.value = withSpring(0.97, { damping: 50, stiffness: 300 });
            bg.value = withTiming(1, { duration: 120 });
          }}
          onTouchEnd={() => {
            scale.value = withSpring(1, { damping: 50, stiffness: 300 });
            bg.value = withTiming(0, { duration: 120 });
            onPlaySound?.(char);
          }}
          style={{
            borderRadius: 14,
            paddingVertical: paddingVertical ?? 0,
          }}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLetter}>{char}</Text>
            <Text style={[styles.cardScore, scoreStyle]}>
              {scoreValue === 0 ? '' : formatScore(scoreValue)}
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
      </Animated.View>
    );
  }

  return (
    <View style={styles.panel}>
      <BlurView
        intensity={24}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.header}>
        <Text style={styles.title}>Reference</Text>
        <GlassContainer spacing={6} style={styles.actions}>
          <TextButton
            text="Reset"
            onPress={onResetScores}
            color="rgba(255, 90, 96, 0.95)"
            style={styles.resetButton}
            accessibilityLabel="Reset scores"
          />
          <TextButton
            text="Close"
            onPress={handleClose}
            accessibilityLabel="Close reference"
          />
        </GlassContainer>
      </View>
      <Animated.View style={panelAnimStyle}>
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
                    color: 'hsl(154, 0%, 58%)',
                    fontWeight: '600',
                    marginVertical: 12,
                    marginLeft: 2,
                    letterSpacing: 1,
                    fontSize: 13,
                  }}
                >
                  Level {level}
                </Text>
                <GlassContainer
                  spacing={8}
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {levelLetters.map((char) => (
                    <ReferenceCard key={char} char={char} />
                  ))}
                </GlassContainer>
              </View>
            );
          })}
          <View style={styles.rowSpacer} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: 520,
    borderRadius: 20,
    paddingBottom: 4,
    paddingTop: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.95,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    position: 'absolute',
    padding: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    experimental_backgroundImage:
      'linear-gradient(0deg,transparent,rgba(0,0,0, 0.9),rgba(0,0,0, 0.9),rgba(0,0,0, 0.9))',
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
    gap: 4,
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
    paddingTop: 64,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    borderRadius: 20,
  },
  rowSpacer: {
    width: '100%',
    height: 8,
  },
  scrollArea: {
    width: '100%',
    height: '100%',
  },
  card: {
    width: '30%',
    minWidth: 86,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'hsla(209, 34%, 12%, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    // marginBottom: 12,
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
