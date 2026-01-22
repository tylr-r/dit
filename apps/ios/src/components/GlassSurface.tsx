import { DitGlassView } from 'dit-native';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type GlassSurfaceProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark'; // kept for api compat, but native handles system theme
}>;

export const GlassSurface = ({
  children,
  style,
  contentStyle,
  intensity = 35,
}: GlassSurfaceProps) => {
  return (
    <View style={[styles.container, style]}>
      <DitGlassView 
        style={StyleSheet.absoluteFill} 
        intensity={intensity} 
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    // Native view handles border and background blur
    overflow: 'hidden',
    // Shadow can be applied to the container layer on RN side if needed, 
    // but native liquid glass usually implies "floating" so we can keep shadow here.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, // Reduced opacity for lighter feel
    shadowRadius: 28,
  },
  content: {
    padding: 16,
  },
});
