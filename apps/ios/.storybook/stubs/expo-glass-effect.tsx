import React from 'react'
import { View, type ViewProps } from 'react-native'

export type GlassStyle = 'regular' | 'clear'

export function GlassView({ children, style, ...rest }: ViewProps & { glassEffectStyle?: GlassStyle; tintColor?: string; isInteractive?: boolean }) {
  return <View style={[{ backgroundColor: 'rgba(255,255,255,0.06)' }, style]} {...rest}>{children}</View>
}

export function GlassContainer({ children, style, ...rest }: ViewProps & { spacing?: number }) {
  return <View style={style} {...rest}>{children}</View>
}
