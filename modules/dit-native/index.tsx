import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from 'expo-modules-core'
import React from 'react'
import { View, type ViewProps } from 'react-native'

export type DitNativeModule = {
  startTone?: () => Promise<void>
  stopTone?: () => Promise<void>
  playTone?: (durationMs: number) => Promise<void>
  triggerHaptic?: (kind: 'dot' | 'dash' | 'success') => Promise<void>
}

export const DitNative =
  requireOptionalNativeModule<DitNativeModule>('DitNative')

const createNativeViewManager = <Props extends ViewProps>(name: string) => {
  try {
    return requireNativeViewManager<Props>(name)
  } catch (error) {
    if (__DEV__) {
      console.warn(`[dit-native] ${name} unavailable`, error)
    }
    return (props: Props) => <View {...props} />
  }
}

export type DitGlassViewProps = ViewProps & {
  intensity?: number
}

const NativeDitGlassView =
  createNativeViewManager<DitGlassViewProps>('DitGlassView')

/** Renders the native glass blur surface used in iOS layouts. */
export const DitGlassView = (props: DitGlassViewProps) => {
  return <NativeDitGlassView {...props} />
}

export type DitGlassSegmentedControlProps = ViewProps & {
  items: string[]
  selectedIndex: number
  onValueChange?: (event: { nativeEvent: { value: number } }) => void
}

const NativeDitGlassSegmentedControl =
  createNativeViewManager<DitGlassSegmentedControlProps>(
    'DitGlassSegmentedControl',
  )

/** Renders the native segmented control used for mode selection. */
export const DitGlassSegmentedControl = (
  props: DitGlassSegmentedControlProps,
) => {
  return <NativeDitGlassSegmentedControl {...props} />
}
