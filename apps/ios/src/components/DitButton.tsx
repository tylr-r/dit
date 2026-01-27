import { MaterialIcons } from '@expo/vector-icons';
import { GlassStyle, GlassView } from 'expo-glass-effect';
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
  paddingHorizontal?: number;
  paddingVertical?: number;
  radius?: number;
  glassEffectStyle?: GlassStyle;
};

/**
 * Standard button that can render text or arbitrary children (icons).
 */
export function DitButton({
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
  paddingHorizontal = 8,
  paddingVertical = 8,
  radius,
  glassEffectStyle = 'regular',
}: ButtonProps) {
  const borderRadius = radius ?? 10;
  const label = accessibilityLabel || text;
  const finalIconSize =
    iconSize ?? (size ? Math.max(10, Math.round(size * 0.55)) : 18);
  const sizeStyle = size ? { width: size, height: size } : null;
  return (
    <GlassView
      glassEffectStyle={glassEffectStyle}
      tintColor="rgba(0,0,0,0.75)"
      isInteractive
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      style={[
        styles.button,
        style,
        { borderRadius },
        sizeStyle,
        backgroundColor && { backgroundColor },
        { paddingHorizontal },
        { paddingVertical },
      ]}
    >
      <Pressable onPress={onPress}>
        {children ? (
          children
        ) : icon ? (
          <SymbolView
            name={icon as any}
            size={1}
            tintColor={
              iconColor ?? (color as string) ?? 'rgba(244, 247, 249, 0.9)'
            }
            style={[{ width: finalIconSize, height: finalIconSize }]}
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
          <Text style={[styles.buttonText, color && { color }, textStyle]}>
            {text}
          </Text>
        )}
      </Pressable>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.8)',
    textAlign: 'center',
  },
});
