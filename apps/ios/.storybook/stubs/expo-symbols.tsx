import React from 'react'
import { Text, View } from 'react-native'

export function SymbolView({ name, size, tintColor, style, fallback }: any) {
  if (fallback) return fallback
  return (
    <View style={style}>
      <Text style={{ color: tintColor, fontSize: typeof size === 'number' && size > 1 ? size : 16 }}>{name}</Text>
    </View>
  )
}
