import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from './GlassSurface';

type GlassButtonProps = {
  label: string;
  onPress: () => void;
};

export const GlassButton = ({ label, onPress }: GlassButtonProps) => (
  <Pressable onPress={onPress}>
    {({ pressed }) => (
      <View style={pressed ? styles.pressed : undefined}>
        <GlassSurface style={styles.surface} intensity={45}>
          <Text style={styles.label}>{label}</Text>
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
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
