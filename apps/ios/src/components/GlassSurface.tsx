import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeGlassView } from '../native/ditNative';

const USE_NATIVE_GLASS = false;

type GlassSurfaceProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark';
}>;

export const GlassSurface = ({
  children,
  style,
  contentStyle,
  intensity = 35,
  tint = 'dark',
}: GlassSurfaceProps) => {
  const gradientColors =
    tint === 'dark'
      ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)']
      : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.05)'];
  const blurTint = tint === 'dark' ? 'dark' : 'light';
  if (NativeGlassView && USE_NATIVE_GLASS) {
    return (
      <NativeGlassView style={[styles.container, style]} intensity={intensity}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </NativeGlassView>
    );
  }
  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={intensity}
        tint={blurTint}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(12,18,24,0.72)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
  },
  content: {
    padding: 16,
  },
});
