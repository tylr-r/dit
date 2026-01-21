import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

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
      <View
        style={[
          styles.surface,
          style,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={[styles.content, contentStyle]}>
          <Text
            style={[styles.label, disabled && styles.labelDisabled, labelStyle]}
          >
            {label}
          </Text>
        </View>
      </View>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  surface: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
