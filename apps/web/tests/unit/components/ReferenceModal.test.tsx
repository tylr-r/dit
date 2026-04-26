import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceModal } from '../../../src/components/ReferenceModal'
import { MORSE_DATA, initializeScores } from '@dit/core'

const baseProps = {
  letters: ['A', 'B', 'E'] as const,
  numbers: ['1', '2'] as const,
  morseData: MORSE_DATA,
  onClose: vi.fn(),
  onResetScores: vi.fn(),
  scores: initializeScores(),
  hero: { kind: 'mastered', count: 0, total: 36 } as const,
  todayCorrect: 0,
  onPlayCharacter: vi.fn(),
  streakAtRisk: false,
}

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
        streakAtRisk={false}
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
        streakAtRisk={false}
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

  it('fires onPlayCharacter when a reference card is clicked', () => {
    const onPlayCharacter = vi.fn()
    render(<ReferenceModal {...baseProps} onPlayCharacter={onPlayCharacter} />)
    const card = screen.getByRole('button', { name: /play morse for E/i })
    fireEvent.click(card)
    expect(onPlayCharacter).toHaveBeenCalledWith('E')
  })

  it('marks the streak row as at-risk when streakAtRisk is true', () => {
    const { container } = render(<ReferenceModal {...baseProps} streakAtRisk />)
    const row = container.querySelector('.reference-streak')
    expect(row?.className).toContain('is-at-risk')
  })

  it('does not mark the streak row at-risk by default', () => {
    const { container } = render(<ReferenceModal {...baseProps} />)
    const row = container.querySelector('.reference-streak')
    expect(row?.className).not.toContain('is-at-risk')
  })
})
