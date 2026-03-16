import type { Meta, StoryObj } from '@storybook/react-native'
import { Text, View } from 'react-native'
import { ModalShell } from './ModalShell'

const meta: Meta<typeof ModalShell> = {
  title: 'ModalShell',
  component: ModalShell,
  argTypes: {
    cardPressable: { control: 'boolean' },
    allowBackdropDismiss: { control: 'boolean' },
    onClose: { action: 'close' },
  },
  decorators: [
    (Story) => (
      <View style={{ flex: 1, height: 400 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof ModalShell>

export const Default: Story = {
  args: {
    allowBackdropDismiss: true,
    children: (
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
          Modal Title
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' }}>
          This is example content inside the modal shell.
        </Text>
      </View>
    ),
  },
}

export const NoDismiss: Story = {
  args: {
    allowBackdropDismiss: false,
    children: (
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 14 }}>
          Backdrop dismiss disabled
        </Text>
      </View>
    ),
  },
}
