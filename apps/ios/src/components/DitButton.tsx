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
  const flattenedStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const hasExplicitWidth = size != null || flattenedStyle?.width != null;
  const hasExplicitHeight = size != null || flattenedStyle?.height != null;
  const resolvedPaddingHorizontal = padding ?? paddingHorizontal;
  const resolvedPaddingVertical = padding ?? paddingVertical;
  const isIconOnly = Boolean(icon && !text && !children);
  const iconOnlySize = getIconOnlySize({
    isIconOnly,
    hasExplicitWidth,
    hasExplicitHeight,
    iconSize: finalIconSize,
    paddingHorizontal: resolvedPaddingHorizontal,
    paddingVertical: resolvedPaddingVertical,
  });
  const sizeStyle = getSizeStyle(size, iconOnlySize);
  const resolvedWidth = flattenedStyle?.width ?? size ?? iconOnlySize;
  const resolvedHeight = flattenedStyle?.height ?? size ?? iconOnlySize;
  const circleDiameter = getCircleDiameter(
    isCircle,
    resolvedWidth,
    resolvedHeight,
  );
  const borderRadius =
    circleDiameter != null ? circleDiameter / 2 : radius ?? 10;
  const pressableFillStyle = getPressableFillStyle(
    resolvedWidth,
    resolvedHeight,
  );
  const paddingStyle = getPaddingStyle(
    padding,
    resolvedPaddingHorizontal,
    resolvedPaddingVertical,
  );
  const iconTintColor =
    iconColor ?? (color as string) ?? 'rgba(244, 247, 249, 0.9)';
  let content: React.ReactNode;
  if (children) {
    content = children;
  } else if (icon) {
    content = (
      <View style={{ width: finalIconSize, height: finalIconSize }}>
        <SymbolView
          name={icon as any}
          size={1}
          tintColor={iconTintColor}
          style={[{ width: finalIconSize, height: finalIconSize }]}
          fallback={
            <MaterialIcons
              name={icon as any}
              size={finalIconSize}
              color={iconTintColor}
            />
          }
        />
      </View>
    );
  } else {
    content = (
      <Text style={[styles.buttonText, color && { color }, textStyle]}>
        {text}
      </Text>
    );
  }
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
          { borderRadius },
          paddingStyle,
        ]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    </GlassView>
  );
}

type SizeValue = ViewStyle['width'];

type IconOnlySizeOptions = {
  isIconOnly: boolean;
  hasExplicitWidth: boolean;
  hasExplicitHeight: boolean;
  iconSize: number;
  paddingHorizontal: number;
  paddingVertical: number;
};

const getIconOnlySize = ({
  isIconOnly,
  hasExplicitWidth,
  hasExplicitHeight,
  iconSize,
  paddingHorizontal,
  paddingVertical,
}: IconOnlySizeOptions) => {
  if (!isIconOnly || hasExplicitWidth || hasExplicitHeight) {
    return null;
  }

  return Math.max(
    iconSize + paddingHorizontal * 2,
    iconSize + paddingVertical * 2,
  );
};

const getSizeStyle = (size?: number, iconOnlySize?: number | null) => {
  if (size != null) {
    return { width: size, height: size };
  }

  if (iconOnlySize != null) {
    return { width: iconOnlySize, height: iconOnlySize };
  }

  return null;
};

const getCircleDiameter = (
  isCircle: boolean,
  width?: SizeValue,
  height?: SizeValue,
) => {
  if (!isCircle) {
    return null;
  }

  const numericWidth = typeof width === 'number' ? width : null;
  const numericHeight = typeof height === 'number' ? height : null;

  if (numericWidth == null && numericHeight == null) {
    return null;
  }

  return Math.min(numericWidth ?? Infinity, numericHeight ?? Infinity);
};

const getPressableFillStyle = (width?: SizeValue, height?: SizeValue) => {
  if (width == null && height == null) {
    return null;
  }

  return {
    ...(width != null ? { width } : null),
    ...(height != null ? { height } : null),
  };
};

const getPaddingStyle = (
  padding: number | undefined,
  paddingHorizontal: number,
  paddingVertical: number,
) =>
  padding != null
    ? { padding }
    : {
        paddingHorizontal,
        paddingVertical,
      };

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
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
