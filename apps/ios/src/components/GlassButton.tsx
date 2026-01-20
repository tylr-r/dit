import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { GlassSurface } from './GlassSurface';

type GlassButtonProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
};

export const GlassButton = ({
  label,
  onPress,
  style,
  labelStyle,
  disabled = false,
}: GlassButtonProps) => (
  <Pressable onPress={onPress} disabled={disabled}>
    {({ pressed }) => (
      <View style={[pressed && styles.pressed, disabled && styles.disabled]}>
        <GlassSurface style={[styles.surface, style]} intensity={45}>
          <Text
            style={[styles.label, disabled && styles.labelDisabled, labelStyle]}
          >
            {label}
          </Text>
        </GlassSurface>
      </View>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  surface: {
    borderRadius: 999,
  },
  label: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelDisabled: {
    color: '#94a3b8',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
