import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';
import type { ViewProps } from 'react-native';

type DitNativeModule = {
  startTone?: () => Promise<void>;
  stopTone?: () => Promise<void>;
  playTone?: (durationMs: number) => Promise<void>;
  triggerHaptic?: (kind: 'dot' | 'dash' | 'success') => Promise<void>;
};

type NativeGlassViewProps = ViewProps & {
  intensity?: number;
};

export const DitNative = requireOptionalNativeModule<DitNativeModule>('DitNative');
export const NativeGlassView = (() => {
  try {
    return requireNativeViewManager<NativeGlassViewProps>('DitGlassView');
  } catch {
    return null;
  }
})();
