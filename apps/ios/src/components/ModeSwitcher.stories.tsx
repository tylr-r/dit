import type { Meta, StoryObj } from '@storybook/react-native'
import { View } from 'react-native'
import { ModeSwitcher } from './ModeSwitcher'

const meta: Meta<typeof ModeSwitcher> = {
  title: 'ModeSwitcher',
  component: ModeSwitcher,
  argTypes: {
    value: {
      control: 'select',
      options: ['practice', 'freestyle', 'listen'],
    },
    onChange: { action: 'changed' },
  },
  decorators: [
    (Story) => (
      <View style={{ alignItems: 'center', paddingTop: 40 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof ModeSwitcher>

export const Practice: Story = {
  args: { value: 'practice' },
}

export const Freestyle: Story = {
  args: { value: 'freestyle' },
}

export const Listen: Story = {
  args: { value: 'listen' },
}
