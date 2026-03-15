import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { View } from 'react-native'
import { DitButton } from './DitButton'

const meta: Meta<typeof DitButton> = {
  title: 'DitButton',
  component: DitButton,
  argTypes: {
    text: { control: 'text' },
    disabled: { control: 'boolean' },
    size: { control: { type: 'number', min: 24, max: 80 } },
    icon: { control: 'text' },
    isCircle: { control: 'boolean' },
    backgroundColor: { control: 'color' },
    color: { control: 'color' },
    onPress: { action: 'pressed' },
  },
  decorators: [
    (Story) => (
      <View style={{ alignItems: 'flex-start', gap: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof DitButton>

export const Text: Story = {
  args: {
    text: 'Press me',
  },
}

export const WithIcon: Story = {
  args: {
    icon: 'star.fill',
    iconSize: 20,
  },
}

export const Disabled: Story = {
  args: {
    text: 'Disabled',
    disabled: true,
  },
}

export const Circular: Story = {
  args: {
    icon: 'plus',
    size: 48,
    isCircle: true,
  },
}
