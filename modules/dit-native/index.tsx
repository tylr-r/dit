import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { ViewProps } from 'react-native';

// --- Native Logic Module ---
const DitNative = requireNativeModule('DitNative');

export function startTone(): Promise<void> {
  return DitNative.startTone();
}

export function stopTone(): Promise<void> {
  return DitNative.stopTone();
}

export function playTone(durationMs: number): Promise<void> {
  return DitNative.playTone(durationMs);
}

export function triggerHaptic(kind: 'dash' | 'dot' | 'success' | 'warning' | 'error' | 'light'): Promise<void> {
  return DitNative.triggerHaptic(kind);
}

// --- Components ---

// DitGlassView
export type DitGlassViewProps = ViewProps & {
  intensity?: number;
};
const NativeDitGlassView: React.ComponentType<DitGlassViewProps> = requireNativeViewManager('DitGlassView');

export const DitGlassView = (props: DitGlassViewProps) => {
  return <NativeDitGlassView {...props} />;
};


// DitGlassSegmentedControl
export type DitGlassSegmentedControlProps = ViewProps & {
  items: string[];
  selectedIndex: number;
  onValueChange?: (event: { nativeEvent: { value: number } }) => void;
};
const NativeDitGlassSegmentedControl: React.ComponentType<DitGlassSegmentedControlProps> = requireNativeViewManager('DitGlassSegmentedControl');

export const DitGlassSegmentedControl = (props: DitGlassSegmentedControlProps) => {
  return <NativeDitGlassSegmentedControl {...props} />;
};


// DitGlassButton
export type DitGlassButtonProps = ViewProps & {
  title: string;
  systemIcon?: string;
  variant?: 'primary' | 'secondary';
  onButtonPress?: (event: { nativeEvent: {} }) => void;
};
const NativeDitGlassButton: React.ComponentType<DitGlassButtonProps> = requireNativeViewManager('DitGlassButton');

export const DitGlassButton = (props: DitGlassButtonProps) => {
  return <NativeDitGlassButton {...props} />;
};
