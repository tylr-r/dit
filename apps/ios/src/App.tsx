import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  DASH_THRESHOLD,
  MORSE_CODE,
  WPM_RANGE,
  formatWpm,
  getRandomLetter,
  type Letter,
} from '@dit/core';
import { GlassButton } from './components/GlassButton';
import { GlassSurface } from './components/GlassSurface';
import { startTone, stopTone, unloadTone } from './native/audio';
import {
  triggerDashHaptic,
  triggerDotHaptic,
  triggerSuccessHaptic,
} from './native/haptics';

const LETTERS = Object.keys(MORSE_CODE) as Letter[];

const pickNextLetter = (previous?: Letter) =>
  getRandomLetter(LETTERS, previous);

export default function App() {
  const [targetLetter, setTargetLetter] = useState<Letter>(() => pickNextLetter());
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const pressStartRef = useRef<number | null>(null);
  const drift = useRef(new Animated.Value(0)).current;
  const targetCode = MORSE_CODE[targetLetter].code;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 16000,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 16000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  useEffect(() => () => void unloadTone(), []);

  useEffect(() => {
    if (input.length === 0) {
      return;
    }
    if (input.length < targetCode.length) {
      return;
    }
    const isMatch = input === targetCode;
    setResult(isMatch ? 'correct' : 'wrong');
    if (isMatch) {
      void triggerSuccessHaptic();
    }
    const timeout = setTimeout(() => {
      setInput('');
      setResult(null);
      setTargetLetter((previous) => pickNextLetter(previous));
    }, isMatch ? 700 : 900);
    return () => clearTimeout(timeout);
  }, [input, targetCode]);

  const handlePressIn = async () => {
    pressStartRef.current = Date.now();
    await startTone();
  };

  const handlePressOut = async () => {
    const start = pressStartRef.current;
    pressStartRef.current = null;
    await stopTone();
    if (!start) {
      return;
    }
    const duration = Date.now() - start;
    const signal = duration >= DASH_THRESHOLD ? '-' : '.';
    if (signal === '-') {
      void triggerDashHaptic();
    } else {
      void triggerDotHaptic();
    }
    setInput((previous) => previous + signal);
  };

  const headerWpm = useMemo(
    () => formatWpm((WPM_RANGE[0] + WPM_RANGE[1]) / 2),
    [],
  );

  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 14],
  });
  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -16],
  });

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#e2e8f0', '#f8fafc', '#e0f2fe']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbOne,
          { transform: [{ translateX: driftX }, { translateY: driftY }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbTwo,
          {
            transform: [
              { translateX: Animated.multiply(driftX, -0.8) },
              { translateY: Animated.multiply(driftY, 0.7) },
            ],
          },
        ]}
      />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>DIT</Text>
            <Text style={styles.title}>Liquid Morse</Text>
          </View>
          <GlassSurface style={styles.wpmPill} intensity={30}>
            <Text style={styles.wpmText}>{headerWpm} WPM</Text>
          </GlassSurface>
        </View>

        <GlassSurface style={styles.card} intensity={40}>
          <Text style={styles.cardLabel}>Target</Text>
          <Text style={styles.targetLetter}>{targetLetter}</Text>
          <Text style={styles.targetCode}>{targetCode}</Text>
          <Text style={styles.mnemonic}>{MORSE_CODE[targetLetter].mnemonic}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Input</Text>
            <Text style={styles.progressValue}>{input || '--'}</Text>
          </View>
          {result && (
            <Text
              style={[
                styles.result,
                result === 'correct' ? styles.resultGood : styles.resultBad,
              ]}
            >
              {result === 'correct' ? 'Nice. Next letter.' : 'Close. Try again.'}
            </Text>
          )}
        </GlassSurface>

        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          {({ pressed }) => (
            <GlassSurface
              style={[styles.morsePad, pressed && styles.morsePadPressed]}
              intensity={55}
            >
              <Text style={styles.morseTitle}>Tap + Hold</Text>
              <Text style={styles.morseHint}>Dot or dash - release to commit</Text>
            </GlassSurface>
          )}
        </Pressable>

        <View style={styles.actions}>
          <GlassButton label="Clear" onPress={() => setInput('')} />
          <GlassButton
            label="Skip"
            onPress={() => {
              setInput('');
              setResult(null);
              setTargetLetter((previous) => pickNextLetter(previous));
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 3.2,
    fontWeight: '600',
    color: '#334155',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  wpmPill: {
    borderRadius: 999,
  },
  wpmText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  card: {
    paddingVertical: 22,
  },
  cardLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    color: '#64748b',
  },
  targetLetter: {
    fontSize: 64,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 6,
  },
  targetCode: {
    fontSize: 20,
    letterSpacing: 4,
    color: '#1e293b',
    marginTop: 6,
  },
  mnemonic: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
  },
  progressRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  progressValue: {
    fontSize: 16,
    letterSpacing: 3,
    color: '#0f172a',
  },
  result: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  resultGood: {
    color: '#0f766e',
  },
  resultBad: {
    color: '#b91c1c',
  },
  morsePad: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  morsePadPressed: {
    transform: [{ scale: 0.98 }],
  },
  morseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  morseHint: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.6,
  },
  orbOne: {
    width: 240,
    height: 240,
    backgroundColor: 'rgba(148, 163, 184, 0.45)',
    top: -60,
    right: -80,
  },
  orbTwo: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(125, 211, 252, 0.45)',
    bottom: 120,
    left: -60,
  },
});
