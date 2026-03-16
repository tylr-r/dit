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
  args: { listenStatus: 'idle' },
}

export const AfterSuccess: Story = {
  args: { listenStatus: 'success' },
}

export const AfterError: Story = {
  args: { listenStatus: 'error' },
}
