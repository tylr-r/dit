import type { Meta, StoryObj } from '@storybook/react-native'
import { View } from 'react-native'
import { MorseButton } from './MorseButton'

const meta: Meta<typeof MorseButton> = {
  title: 'MorseButton',
  component: MorseButton,
  argTypes: {
    disabled: { control: 'boolean' },
    isPressing: { control: 'boolean' },
    onPressIn: { action: 'pressIn' },
    onPressOut: { action: 'pressOut' },
  },
  decorators: [
    (Story) => (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof MorseButton>

export const Default: Story = {
  args: {
    isPressing: false,
  },
}

export const Pressing: Story = {
  args: {
    isPressing: true,
  },
}

export const Disabled: Story = {
  args: {
    isPressing: false,
    disabled: true,
  },
}
