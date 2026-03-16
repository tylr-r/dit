import type { Meta, StoryObj } from '@storybook/react-native'
import { View } from 'react-native'
import { ListenSineWave } from './ListenSineWave'

const meta: Meta<typeof ListenSineWave> = {
  title: 'ListenSineWave',
  component: ListenSineWave,
  argTypes: {
    liveActive: { control: 'boolean' },
    tintStatus: {
      control: 'select',
      options: ['idle', 'success', 'error'],
    },
  },
  decorators: [
    (Story) => (
      <View style={{ height: 180, width: '100%' }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof ListenSineWave>

export const Idle: Story = {
  args: {
    playback: null,
    liveActive: false,
  },
}

export const Active: Story = {
  args: {
    playback: null,
    liveActive: true,
  },
}

export const SuccessTint: Story = {
  args: {
    playback: null,
    tintStatus: 'success',
  },
}

export const ErrorTint: Story = {
  args: {
    playback: null,
    tintStatus: 'error',
  },
}
