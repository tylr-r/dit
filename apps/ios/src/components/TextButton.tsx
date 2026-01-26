import { GlassView } from 'expo-glass-effect';
import React from 'react';
import {
  AccessibilityRole,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

export type TextButtonProps = {
  /** Button label text */
  text: string;
  /** Called when the button is pressed */
  onPress: () => void;
  /** Optional: override text color */
  color?: string;
  /** Optional: override button background color */
  backgroundColor?: string;
  /** Optional: style overrides for the button container */
  style?: ViewStyle;
  /** Optional: style overrides for the text */
  textStyle?: TextStyle;
  /** Optional: accessibility label */
  accessibilityLabel?: string;
  /** Optional: accessibility role */
  accessibilityRole?: AccessibilityRole;
};

/**
 * Standard text button
 */
export function TextButton({
  text,
  onPress,
  color,
  backgroundColor,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
}: TextButtonProps) {
  return (
    <GlassView
      style={[styles.glass, style]}
      glassEffectStyle="regular"
      tintColor="rgba(0,0,0,0.75)"
      isInteractive
    >
      <Pressable
        onPress={onPress}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel || text}
        style={({ pressed }) => [
          styles.button,
          backgroundColor && { backgroundColor },
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, color && { color }, textStyle]}>
          {text}
        </Text>
      </Pressable>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: 12,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  buttonText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.8)',
  },
});
