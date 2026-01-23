import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type MorseButtonProps = {
  isPressing: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
};

const MorseGradient = () => (
  <Svg
    style={styles.morseGradient}
    width="100%"
    height="100%"
    viewBox="0 0 480 96"
    preserveAspectRatio="none"
  >
    <Defs>
      <LinearGradient id="morseGradient" x1="0.1" y1="0.2" x2="0.9" y2="0.8">
        <Stop offset="0%" stopColor="#a8d0ff" />
        <Stop offset="25%" stopColor="#d0c0f0" />
        <Stop offset="50%" stopColor="#ffccd8" />
        <Stop offset="75%" stopColor="#b8d8ff" />
        <Stop offset="100%" stopColor="#f0d0e8" />
      </LinearGradient>
    </Defs>
    <Rect width="480" height="96" rx="48" fill="url(#morseGradient)" />
  </Svg>
);

/** Tap/press input button for dot/dah entry. */
export function MorseButton({
  isPressing,
  onPressIn,
  onPressOut,
}: MorseButtonProps) {
  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Tap for dot, hold for dah"
      style={styles.morsePressable}
    >
      {({ pressed }) => {
        const isActive = pressed || isPressing;
        return (
          <View style={styles.morseWrap}>
            <View
              style={[styles.morseGlow, isActive && styles.morseGlowPressed]}
            />
            <View
              style={[
                styles.morseButton,
                isActive && styles.morseButtonPressed,
              ]}
            >
              <MorseGradient />
              <View style={styles.morseGlass} />
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  morsePressable: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  morseWrap: {
    width: '100%',
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morseGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    shadowColor: '#c4b5fd',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0.7,
  },
  morseGlowPressed: {
    opacity: 0.95,
    shadowOpacity: 0.7,
    shadowRadius: 24,
  },
  morseButton: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    transform: [{ scale: 1 }],
  },
  morseButtonPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  morseGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  morseGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
