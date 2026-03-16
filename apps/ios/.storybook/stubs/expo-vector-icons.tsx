import React from 'react'
import { Text } from 'react-native'

function IconStub({ name, size = 16, color = '#fff' }: any) {
  return <Text style={{ fontSize: size, color }}>{name}</Text>
}

export const MaterialIcons = IconStub
