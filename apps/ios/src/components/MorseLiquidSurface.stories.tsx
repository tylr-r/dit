import type { Meta, StoryObj } from '@storybook/react-native'
import { View } from 'react-native'
import { MorseLiquidSurface } from './MorseLiquidSurface'

const meta: Meta<typeof MorseLiquidSurface> = {
  title: 'MorseLiquidSurface',
  component: MorseLiquidSurface,
  argTypes: {
    speedMultiplier: { control: { type: 'number', min: 0, max: 5, step: 0.25 } },
  },
  decorators: [
    (Story) => (
      <View style={{ height: 300, width: '100%', borderRadius: 16, overflow: 'hidden' }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof MorseLiquidSurface>

export const Default: Story = {
  args: { speedMultiplier: 1 },
}

export const Slow: Story = {
  args: { speedMultiplier: 0.25 },
}

export const Fast: Story = {
  args: { speedMultiplier: 3 },
}
