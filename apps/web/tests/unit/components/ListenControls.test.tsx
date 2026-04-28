import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Letter } from '@dit/core'
import { describe, expect, it, vi } from 'vitest'
import { ListenControls } from '../../../src/components/ListenControls'

const ALL_LETTERS: Letter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
]

describe('ListenControls', () => {
  it('submits keyboard answers and triggers replay', async () => {
    const onReplay = vi.fn()
    const onSubmitAnswer = vi.fn()
    const user = userEvent.setup()

    render(
      <ListenControls
        availableLetters={ALL_LETTERS}
        listenStatus="idle"
        onReplay={onReplay}
        onSubmitAnswer={onSubmitAnswer}
        showShortcutHints={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(onReplay).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Type A' }))
    expect(onSubmitAnswer).toHaveBeenCalledWith('A')
  })

  it('disables keys that are not in the available set', () => {
    render(
      <ListenControls
        availableLetters={['K', 'M']}
        listenStatus="idle"
        onReplay={vi.fn()}
        onSubmitAnswer={vi.fn()}
        showShortcutHints={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'Type K' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Type M' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'A is not in this set' }),
    ).toBeDisabled()
  })

  it('shows the keyboard shortcut hint when enabled', () => {
    render(
      <ListenControls
        availableLetters={ALL_LETTERS}
        listenStatus="idle"
        onReplay={vi.fn()}
        onSubmitAnswer={vi.fn()}
        showShortcutHints
      />,
    )

    expect(screen.getByText(/press/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Play' }),
    ).toHaveAttribute('title', 'Replay (Space)')
  })

  it('omits the shortcut hint on touch devices', () => {
    render(
      <ListenControls
        availableLetters={ALL_LETTERS}
        listenStatus="idle"
        onReplay={vi.fn()}
        onSubmitAnswer={vi.fn()}
        showShortcutHints={false}
      />,
    )

    expect(screen.queryByText(/press/i)).not.toBeInTheDocument()
  })
})
