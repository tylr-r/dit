import { GlassView } from 'expo-glass-effect';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

type GlassButtonProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  icon?: string;
};

export const GlassButton = ({
  label,
  onPress,
  style,
  disabled = false,
  variant = 'primary',
}: GlassButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        style,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="clear"
        isInteractive
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.85, // More transparent by default to show glass effect
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7, // Even more transparent when pressed
  },
});

