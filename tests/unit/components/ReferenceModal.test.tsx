import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceModal } from '../../../src/components/ReferenceModal'
import { MORSE_DATA } from '../../../src/data/morse'
import { initializeScores } from '../../../src/utils/morseUtils'

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
      />,
    )

    expect(screen.getByLabelText('.-')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset scores' }))
    expect(onResetScores).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
