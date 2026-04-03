import type { Meta, StoryObj } from '@storybook/react-native'
import { View } from 'react-native'
import { ListenControls } from './ListenControls'

const meta: Meta<typeof ListenControls> = {
  title: 'ListenControls',
  component: ListenControls,
  argTypes: {
    listenStatus: {
      control: 'select',
      options: ['idle', 'success', 'error'],
    },
    onReplay: { action: 'replay' },
    onSubmitAnswer: { action: 'submitAnswer' },
  },
  decorators: [
    (Story) => (
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 24 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof ListenControls>

export const Idle: Story = {
  args: {
    availableLetters: ['K', 'M', 'R', 'S', 'U', 'A', 'P', 'T'],
    listenStatus: 'idle',
  },
}

export const AfterSuccess: Story = {
  args: {
    availableLetters: ['K', 'M', 'R', 'S', 'U', 'A', 'P', 'T'],
    listenStatus: 'success',
  },
}

export const AfterError: Story = {
  args: {
    availableLetters: ['K', 'M', 'R', 'S', 'U', 'A', 'P', 'T'],
    listenStatus: 'error',
  },
}
