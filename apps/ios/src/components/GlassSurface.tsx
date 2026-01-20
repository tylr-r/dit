import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

type GlassSurfaceProps = PropsWithChildren<{
  style?: ViewStyle;
  intensity?: number;
}>;

export const GlassSurface = ({ children, style, intensity = 35 }: GlassSurfaceProps) => (
  <View style={[styles.container, style]}>
    <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
    <LinearGradient
      colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.05)']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.content}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  content: {
    padding: 18,
  },
});
