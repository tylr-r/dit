import React from 'react'
import { Text, View } from 'react-native'

export function Host({ children }: any) {
  return <View>{children}</View>
}

export function Picker({ options, selectedIndex, label, onOptionSelected, ...rest }: any) {
  return (
    <View style={{ padding: 8 }}>
      <Text style={{ color: '#fff', fontSize: 14 }}>{label || options?.[selectedIndex] || 'Picker'}</Text>
    </View>
  )
}
