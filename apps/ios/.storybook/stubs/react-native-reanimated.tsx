import React from 'react'
import { View, Text, type ViewProps, type TextProps } from 'react-native'

const Animated = {
  View: React.forwardRef<View, ViewProps>((props, ref) => <View ref={ref} {...props} />),
  Text: React.forwardRef<Text, TextProps>((props, ref) => <Text ref={ref} {...props} />),
  createAnimatedComponent: (Component: any) => Component,
}

export default Animated

export const Easing = {
  in: (fn: any) => fn,
  out: (fn: any) => fn,
  inOut: (fn: any) => fn,
  cubic: (t: number) => t,
  quad: (t: number) => t,
}

export const FadeIn = { duration: () => ({ easing: () => ({}) }) }
export const FadeOut = { duration: () => ({ easing: () => ({}) }) }

export function useSharedValue<T>(initial: T) {
  return { value: initial }
}

export function useAnimatedStyle(factory: () => any) {
  try { return factory() } catch { return {} }
}

export function useAnimatedProps(factory: () => any) {
  try { return factory() } catch { return {} }
}

export function useDerivedValue<T>(factory: () => T) {
  try { return { value: factory() } } catch { return { value: undefined } }
}

export function useFrameCallback(_cb: any) {}

export function withTiming<T>(toValue: T, _config?: any) {
  return toValue
}

export function interpolateColor(progress: number, inputRange: number[], outputRange: string[]) {
  return progress <= inputRange[0] ? outputRange[0] : outputRange[outputRange.length - 1]
}
