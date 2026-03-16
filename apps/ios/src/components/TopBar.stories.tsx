import type { Meta, StoryObj } from '@storybook/react'
import { TopBar } from './TopBar'

const meta: Meta<typeof TopBar> = {
  title: 'TopBar',
  component: TopBar,
  argTypes: {
    mode: {
      control: 'select',
      options: ['practice', 'freestyle', 'listen'],
    },
    showSettingsHint: { control: 'boolean' },
    onModeChange: { action: 'modeChange' },
    onPressAbout: { action: 'pressAbout' },
    onSettingsPress: { action: 'settingsPress' },
  },
}

export default meta

type Story = StoryObj<typeof TopBar>

export const Practice: Story = {
  args: { mode: 'practice' },
}

export const WithSettingsHint: Story = {
  args: {
    mode: 'practice',
    showSettingsHint: true,
  },
}

export const ListenMode: Story = {
  args: { mode: 'listen' },
}
