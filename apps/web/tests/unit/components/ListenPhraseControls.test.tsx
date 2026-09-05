import { fireEvent, render, screen } from '@testing-library/react'
import type { ListenPhraseRound } from '@dit/core'
import { describe, expect, it, vi } from 'vitest'
import { ListenContentSwitcher } from '../../../src/components/ListenContentSwitcher'
import { ListenPhraseControls } from '../../../src/components/ListenPhraseControls'

const round: ListenPhraseRound = {
  target: {
    id: 'qrs',
    text: 'QRS',
    meaning: 'Send slower',
    difficulty: 'medium',
    parts: [{ code: 'QRS', meaning: 'send slower' }],
  },
  options: [
    {
      id: 'tnx',
      text: 'TNX',
      meaning: 'Thanks',
      difficulty: 'medium',
      parts: [{ code: 'TNX', meaning: 'thanks' }],
    },
    {
      id: 'qrs',
      text: 'QRS',
      meaning: 'Send slower',
      difficulty: 'medium',
      parts: [{ code: 'QRS', meaning: 'send slower' }],
    },
    {
      id: 'sri',
      text: 'SRI',
      meaning: 'Sorry',
      difficulty: 'medium',
      parts: [{ code: 'SRI', meaning: 'sorry' }],
    },
    {
      id: 'agn',
      text: 'AGN',
      meaning: 'Again',
      difficulty: 'medium',
      parts: [{ code: 'AGN', meaning: 'again' }],
    },
  ],
}

describe('ListenContentSwitcher', () => {
  it('reports the selected content type and disables unavailable words', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ListenContentSwitcher
        value="characters"
        phrasesDisabled
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'Characters' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Words' })).toBeDisabled()

    rerender(
      <ListenContentSwitcher
        value="phrases"
        phrasesDisabled={false}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Characters' }))
    expect(onChange).toHaveBeenCalledWith('characters')
  })
})

describe('ListenPhraseControls', () => {
  it('shows an English answer without inventing a teaching definition', () => {
    render(
      <ListenPhraseControls
        round={{ ...round, target: { id: 'time', text: 'TIME', difficulty: 'short', parts: [] } }}
        status="success"
        isPlaying={false}
        selectedPhraseId="time"
        attemptCount={1}
        correctCount={1}
        onStart={vi.fn()}
        onSubmitAnswer={vi.fn()}
        onReplay={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'TIME' })).toBeInTheDocument()
    expect(document.querySelector('.listen-phrase-feedback dl')).toBeNull()
  })

  it('conceals all choices during sound and reveals them together afterward', () => {
    const props = {
      round,
      status: 'idle' as const,
      selectedPhraseId: null,
      attemptCount: 0,
      correctCount: 0,
      onStart: vi.fn(),
      onSubmitAnswer: vi.fn(),
      onReplay: vi.fn(),
      onNext: vi.fn(),
    }
    const { rerender } = render(<ListenPhraseControls {...props} isPlaying />)

    expect(screen.queryAllByRole('button', { name: /Answer/ })).toHaveLength(0)
    for (const option of round.options) {
      expect(screen.queryByText(option.text)).not.toBeInTheDocument()
    }
    expect(screen.getByRole('status')).toHaveTextContent('Listening')

    rerender(<ListenPhraseControls {...props} isPlaying={false} />)
    expect(screen.getAllByRole('button', { name: /Answer/ })).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Answer QRS' }))
    expect(props.onSubmitAnswer).toHaveBeenCalledWith('qrs')
  })

  it('waits for the learner to start before showing a word round', () => {
    const onStart = vi.fn()
    render(
      <ListenPhraseControls
        round={null}
        isPlaying={false}
        status="idle"
        selectedPhraseId={null}
        attemptCount={0}
        correctCount={0}
        onStart={onStart}
        onSubmitAnswer={vi.fn()}
        onReplay={vi.fn()}
        onNext={vi.fn()}
      />,
    )

    expect(screen.getByText('Ready when you are')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Word answers' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('keeps the meaning hidden while the learner chooses an answer', () => {
    render(
      <ListenPhraseControls
        round={round}
        status="idle"
        isPlaying={false}
        selectedPhraseId={null}
        attemptCount={0}
        correctCount={0}
        onStart={vi.fn()}
        onSubmitAnswer={vi.fn()}
        onReplay={vi.fn()}
        onNext={vi.fn()}
      />,
    )

    expect(screen.getByText('Choose what you heard')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Answer/ })).toHaveLength(4)
    expect(screen.queryByText('Send slower')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next word' })).not.toBeInTheDocument()
  })

  it('reveals the correct word meaning', () => {
    render(
      <ListenPhraseControls
        round={round}
        status="success"
        isPlaying={false}
        selectedPhraseId="qrs"
        attemptCount={1}
        correctCount={1}
        onStart={vi.fn()}
        onSubmitAnswer={vi.fn()}
        onReplay={vi.fn()}
        onNext={vi.fn()}
      />,
    )

    expect(screen.getByText('Send slower')).toBeInTheDocument()
    expect(screen.getAllByText('QRS')).toHaveLength(2)
    expect(screen.getByText('send slower')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Answer QRS' })).toHaveClass(
      'is-correct',
    )
    expect(screen.getByText('1 / 1 correct')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next word' })).toBeInTheDocument()
  })

  it('submits an option once and exposes replay and next actions', () => {
    const onSubmitAnswer = vi.fn()
    const onReplay = vi.fn()
    const onNext = vi.fn()
    const { rerender } = render(
      <ListenPhraseControls
        round={round}
        status="idle"
        isPlaying={false}
        selectedPhraseId={null}
        attemptCount={0}
        correctCount={0}
        onStart={vi.fn()}
        onSubmitAnswer={onSubmitAnswer}
        onReplay={onReplay}
        onNext={onNext}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Answer SRI' }))
    expect(onSubmitAnswer).toHaveBeenCalledWith('sri')
    fireEvent.click(screen.getByRole('button', { name: 'Replay word' }))
    expect(onReplay).toHaveBeenCalledOnce()

    rerender(
      <ListenPhraseControls
        round={round}
        status="error"
        isPlaying={false}
        selectedPhraseId="sri"
        attemptCount={1}
        correctCount={0}
        onStart={vi.fn()}
        onSubmitAnswer={onSubmitAnswer}
        onReplay={onReplay}
        onNext={onNext}
      />,
    )
    expect(screen.getByRole('button', { name: 'Answer SRI' })).toHaveClass(
      'is-incorrect',
    )
    expect(screen.getByRole('button', { name: 'Answer QRS' })).toHaveClass(
      'is-correct',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
