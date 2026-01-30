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
  View,
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
  /** Vertical and Horizontal padding, this overrides paddingHorizontal and paddingVertical */
  padding?: number;
  radius?: number;
  /** Force a perfectly circular button (requires explicit square size) */
  isCircle?: boolean;
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
  padding,
  radius,
  isCircle = false,
  glassEffectStyle = 'regular',
}: ButtonProps) {
  const label = accessibilityLabel || text;
  const finalIconSize =
    iconSize ?? (size ? Math.max(10, Math.round(size * 0.55)) : 18);
  const flattenedStyle = StyleSheet.flatten(style);
  const hasBaseWidth = size != null || flattenedStyle?.width != null;
  const hasBaseHeight = size != null || flattenedStyle?.height != null;
  const resolvedPaddingHorizontal = padding ?? paddingHorizontal;
  const resolvedPaddingVertical = padding ?? paddingVertical;
  const isIconOnly = Boolean(icon && !text && !children);
  const iconOnlySize =
    isIconOnly && !hasBaseWidth && !hasBaseHeight && size == null
      ? Math.max(
          finalIconSize + resolvedPaddingHorizontal * 2,
          finalIconSize + resolvedPaddingVertical * 2
        )
      : null;
  const sizeStyle =
    size != null
      ? { width: size, height: size }
      : iconOnlySize != null
        ? { width: iconOnlySize, height: iconOnlySize }
        : null;
  const resolvedWidth = flattenedStyle?.width ?? size ?? iconOnlySize;
  const resolvedHeight = flattenedStyle?.height ?? size ?? iconOnlySize;
  const hasExplicitWidth = resolvedWidth != null;
  const hasExplicitHeight = resolvedHeight != null;
  const circleDiameter =
    isCircle &&
    (typeof resolvedWidth === 'number' || typeof resolvedHeight === 'number')
      ? Math.min(
          typeof resolvedWidth === 'number' ? resolvedWidth : Infinity,
          typeof resolvedHeight === 'number' ? resolvedHeight : Infinity
        )
      : null;
  const borderRadius = circleDiameter != null ? circleDiameter / 2 : radius ?? 10;
  const pressableFillStyle =
    hasExplicitWidth || hasExplicitHeight
      ? {
          ...(hasExplicitWidth ? { width: resolvedWidth } : null),
          ...(hasExplicitHeight ? { height: resolvedHeight } : null),
        }
      : null;
  return (
    <GlassView
      glassEffectStyle={glassEffectStyle}
      isInteractive
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      style={[
        styles.button,
        style,
        { borderRadius },
        sizeStyle,
        backgroundColor && { backgroundColor },
      ]}
    >
      <Pressable
        style={[
          styles.pressable,
          pressableFillStyle,
          { backgroundColor: 'red' },
          { borderRadius },
          padding
            ? { padding }
            : {
                paddingHorizontal: resolvedPaddingHorizontal,
                paddingVertical: resolvedPaddingVertical,
              },
        ]}
        onPress={onPress}
      >
        {children ? (
          children
        ) : icon ? (
          <View style={{ width: finalIconSize, height: finalIconSize }}>
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
          </View>
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
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    flexGrow: 1,
    flexShrink: 1,
  },
  buttonText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(244, 247, 249, 0.8)',
    textAlign: 'center',
  },
});
