import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceModal } from '../../../src/components/ReferenceModal'
import { MORSE_DATA, initializeScores } from '@dit/core'

describe('ReferenceModal', () => {
  it('fires reset and close actions', async () => {
    const onClose = vi.fn()
    const onResetScores = vi.fn()
    const scores = initializeScores()
    const user = userEvent.setup()

    render(
      <ReferenceModal
        letters={['A', 'B']}
        numbers={['1', '2']}
        morseData={MORSE_DATA}
        onClose={onClose}
        onResetScores={onResetScores}
        scores={scores}
        hero={{ kind: 'mastered', count: 0, total: 36 }}
        todayCorrect={0}
      />,
    )

    expect(screen.getByLabelText('.-')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset scores' }))
    expect(onResetScores).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders WPM hero and course banner when provided', () => {
    render(
      <ReferenceModal
        letters={['A']}
        numbers={[]}
        morseData={MORSE_DATA}
        onClose={() => {}}
        onResetScores={() => {}}
        scores={initializeScores()}
        hero={{ kind: 'wpm', value: 14.2 }}
        todayCorrect={1}
        courseProgress={{
          packIndex: 0,
          totalPacks: 8,
          phase: 'teach',
          packLetters: ['E', 'T'],
        }}
      />,
    )

    expect(screen.getByText('14.2')).toBeInTheDocument()
    expect(screen.getByText('Best WPM')).toBeInTheDocument()
    expect(screen.getByText(/Pack 1\/8/)).toBeInTheDocument()
  })
})
