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
  contentStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
};

export const GlassButton = ({
  label,
  onPress,
  style,
  contentStyle,
  labelStyle,
  disabled = false,
}: GlassButtonProps) => (
  <Pressable onPress={onPress} disabled={disabled}>
    {({ pressed }) => (
      <View style={[pressed && styles.pressed, disabled && styles.disabled]}>
        <GlassSurface
          style={[styles.surface, style]}
          contentStyle={[styles.content, contentStyle]}
          intensity={45}
        >
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
  content: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  label: {
    color: '#f4f7f9',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  labelDisabled: {
    color: '#8d98a5',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
