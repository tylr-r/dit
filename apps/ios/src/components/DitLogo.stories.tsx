import type { Meta, StoryObj } from '@storybook/react-native'
import { View } from 'react-native'
import DitLogo from './DitLogo'

const meta: Meta<typeof DitLogo> = {
  title: 'DitLogo',
  component: DitLogo,
  decorators: [
    (Story) => (
      <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof DitLogo>

export const Default: Story = {}
