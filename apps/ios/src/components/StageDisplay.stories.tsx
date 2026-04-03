import type { Meta, StoryObj } from '@storybook/react-native'
import { View } from 'react-native'
import { StageDisplay } from './StageDisplay'

const meta: Meta<typeof StageDisplay> = {
  title: 'StageDisplay',
  component: StageDisplay,
  argTypes: {
    letter: { control: 'text' },
    statusText: { control: 'text' },
    statusDetailText: { control: 'text' },
    hintVisible: { control: 'boolean' },
    letterPlaceholder: { control: 'boolean' },
    isListen: { control: 'boolean' },
    isFreestyle: { control: 'boolean' },
    practiceWordMode: { control: 'boolean' },
    practiceWord: { control: 'text' },
    practiceWordIndex: { control: { type: 'number', min: 0, max: 10 } },
    practiceWpmText: { control: 'text' },
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

type Story = StoryObj<typeof StageDisplay>

export const PracticeLetter: Story = {
  args: {
    letter: 'A',
    statusText: 'Tap the pattern',
    hintVisible: true,
    pips: [
      { type: 'dot', state: 'hit' },
      { type: 'dah', state: 'expected' },
    ],
  },
}

export const PracticeComplete: Story = {
  args: {
    letter: 'S',
    statusText: 'Correct!',
    hintVisible: true,
    pips: [
      { type: 'dot', state: 'hit' },
      { type: 'dot', state: 'hit' },
      { type: 'dot', state: 'hit' },
    ],
  },
}

export const PracticeWord: Story = {
  args: {
    letter: 'L',
    statusText: 'Tap the pattern',
    hintVisible: true,
    pips: [
      { type: 'dot', state: 'expected' },
      { type: 'dah', state: 'expected' },
      { type: 'dot', state: 'expected' },
      { type: 'dot', state: 'expected' },
    ],
    practiceWordMode: true,
    practiceWord: 'HELLO',
    practiceWordIndex: 2,
  },
}

export const Placeholder: Story = {
  args: {
    letter: '?',
    statusText: 'Get ready',
    statusDetailText: '2 remaining',
    statusDetailTokens: ['A', 'N'],
    hintVisible: false,
    pips: [],
    letterPlaceholder: true,
  },
}
