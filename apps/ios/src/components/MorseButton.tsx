import { GlassView } from 'expo-glass-effect';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

type MorseButtonProps = {
  isPressing: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
};

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
          <GlassView
            glassEffectStyle="clear"
            style={[
              styles.morseWrap,
              isActive && styles.morseWrapPressed,
              { borderRadius: 48 },
            ]}
          ></GlassView>
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
    transform: [{ scale: 1 }],
  },
  morseWrapPressed: {
    transform: [{ scale: 0.98 }],
  },
});
