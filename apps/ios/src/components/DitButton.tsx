import { MaterialIcons } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  AccessibilityRole,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

export type ButtonProps = {
  /** Optional button label text */
  text?: string;
  /** Optional children (use for icons or custom content) */
  children?: React.ReactNode;
  /** Optional icon name from MaterialIcons */
  icon?: string;
  /** Optional icon size */
  iconSize?: number;
  /** Optional overall button size (height/width for square buttons) */
  size?: number;
  /** Optional icon color */
  iconColor?: string;
  /** Called when the button is pressed */
  onPress: () => void;
  /** Optional: override text color */
  color?: string;
  /** Optional: override button background color */
  backgroundColor?: string;
  /** Optional: style overrides for the container (GlassView) */
  style?: ViewStyle;
  /** Optional: style overrides for the text */
  textStyle?: TextStyle;
  /** Optional: accessibility label */
  accessibilityLabel?: string;
  /** Optional: accessibility role */
  accessibilityRole?: AccessibilityRole;
  paddingVertical?: number;
  paddingHorizontal?: number;
  radius?: number;
};

/**
 * Standard button that can render text or arbitrary children (icons).
 */
export function Button({
  text,
  children,
  icon,
  iconSize = 18,
  size,
  iconColor,
  onPress,
  color,
  backgroundColor,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
  paddingVertical,
  paddingHorizontal,
  radius,
}: ButtonProps) {
  const borderRadius = radius ?? 10;
  const label = accessibilityLabel || text;
  const finalIconSize =
    iconSize ?? (size ? Math.max(10, Math.round(size * 0.55)) : 18);
  const textFontSize = size ? Math.max(10, Math.round(size * 0.28)) : undefined;
  const sizeStyle = size
    ? { width: size, height: size, paddingHorizontal: 0, paddingVertical: 0 }
    : null;
  return (
    <GlassView
      style={[styles.glass, style, { borderRadius }, sizeStyle]}
      glassEffectStyle="regular"
      tintColor="rgba(0,0,0,0.75)"
      isInteractive
    >
      <Pressable
        onPress={onPress}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.button,
          backgroundColor && { backgroundColor },
          pressed && styles.buttonPressed,
          size
            ? { paddingVertical: 0, paddingHorizontal: 0 }
            : {
                paddingVertical: paddingVertical ?? 6,
                paddingHorizontal: paddingHorizontal ?? 10,
              },
          { borderRadius },
        ]}
      >
        {children ? (
          children
        ) : icon ? (
          <SymbolView
            name={icon as any}
            size={finalIconSize}
            tintColor={
              iconColor ?? (color as string) ?? 'rgba(244, 247, 249, 0.9)'
            }
            style={[
              styles.icon,
              { width: finalIconSize, height: finalIconSize },
            ]}
            fallback={
              <MaterialIcons
                name={icon as any}
                size={finalIconSize}
                color={
                  iconColor ?? (color as string) ?? 'rgba(244, 247, 249, 0.9)'
                }
              />
            }
          />
        ) : (
          <Text
            style={[
              styles.buttonText,
              color && { color },
              textStyle,
              textFontSize ? { fontSize: textFontSize } : null,
            ]}
          >
            {text}
          </Text>
        )}
      </Pressable>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  icon: {
    marginHorizontal: 2,
  },
});
