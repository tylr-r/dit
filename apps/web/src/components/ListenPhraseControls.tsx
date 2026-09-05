import type { ListenPhraseRound, ListenVocabulary } from '@dit/core'
import type { ListenPhraseStatus } from '../hooks/useListenPhraseSession'

type ListenPhraseControlsProps = {
  round: ListenPhraseRound | null
  status: ListenPhraseStatus
  isPlaying: boolean
  isAvailable?: boolean
  vocabulary?: ListenVocabulary
  selectedPhraseId: string | null
  attemptCount: number
  correctCount: number
  onStart: () => void
  onSubmitAnswer: (phraseId: string) => void
  onReplay: () => void
  onNext: () => void
}

/** Four-choice Listen exercise with post-answer CW word teaching. */
export function ListenPhraseControls({
  round,
  status,
  isPlaying,
  isAvailable = true,
  vocabulary = 'common',
  selectedPhraseId,
  attemptCount,
  correctCount,
  onStart,
  onSubmitAnswer,
  onReplay,
  onNext,
}: ListenPhraseControlsProps) {
  if (!round) {
    return (
      <section
        className="listen-phrase-controls is-ready"
        aria-label="Listen word exercise"
      >
        <div className="listen-phrase-ready">
          <h2>{isAvailable ? 'Ready when you are' : 'More characters needed'}</h2>
          <p>
            {isAvailable
              ? `Listen to one ${vocabulary === 'common' ? 'English word' : 'Q code'}, then choose what you heard.`
              : 'This set needs at least four choices from your active characters. Try the other set or add more characters.'}
          </p>
          <button
            type="button"
            className="hint-button listen-phrase-start"
            onClick={onStart}
            disabled={!isAvailable}
          >
            Start listening
          </button>
        </div>
      </section>
    )
  }

  const hasAnswered = status !== 'idle'

  return (
    <section className="listen-phrase-controls" aria-label="Listen word exercise">
      <div className="listen-phrase-prompt-row">
        <p className="listen-phrase-prompt" role="status">
          {isPlaying ? 'Listening…' : 'Choose what you heard'}
        </p>
        <p className="listen-phrase-score">
          {correctCount} / {attemptCount} correct
        </p>
      </div>

      <div
        className={`listen-phrase-options${isPlaying ? ' is-concealed' : ''}`}
        role="group"
        aria-label="Word answers"
        aria-hidden={isPlaying}
      >
        {round.options.map((phrase, index) => {
          const isCorrect = !isPlaying && hasAnswered && phrase.id === round.target.id
          const isIncorrect =
            !isPlaying && status === 'error' && phrase.id === selectedPhraseId && !isCorrect
          const stateClass = isCorrect
            ? ' is-correct'
            : isIncorrect
              ? ' is-incorrect'
              : ''

          return (
            <button
              key={index}
              type="button"
              className={`listen-phrase-option${stateClass}`}
              aria-label={isPlaying ? undefined : `Answer ${phrase.text}`}
              disabled={isPlaying || hasAnswered}
              onClick={() => onSubmitAnswer(phrase.id)}
            >
              <span className="listen-phrase-option-mask" aria-hidden="true" />
              <span className="listen-phrase-option-content">
                {!isPlaying ? (
                  <>
                    <span className="listen-phrase-option-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{phrase.text}</span>
                    {isCorrect ? (
                      <span className="listen-phrase-check" aria-hidden="true">✓</span>
                    ) : null}
                  </>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      {hasAnswered ? (
        <div
          className={`listen-phrase-feedback${isPlaying ? ' is-concealed' : ''}`}
          aria-live="polite"
          aria-hidden={isPlaying}
        >
          <p className={`listen-phrase-result is-${status}`}>
            {status === 'success' ? 'Correct' : 'The word was'}
          </p>
          <h2>{round.target.meaning ?? round.target.text}</h2>
          {round.target.parts.length > 0 ? <dl>
            {round.target.parts.map((part) => (
              <div key={`${part.code}-${part.meaning}`}>
                <dt>{part.code}</dt>
                <dd>{part.meaning}</dd>
              </div>
            ))}
          </dl> : null}
        </div>
      ) : null}

      <div className="listen-phrase-actions">
        <button
          type="button"
          className="hint-button"
          aria-label="Replay word"
          onClick={onReplay}
        >
          Replay
        </button>
        {hasAnswered ? (
          <button
            type="button"
            className="hint-button listen-phrase-next"
            aria-label="Next word"
            onClick={onNext}
          >
            Next
          </button>
        ) : null}
      </div>
    </section>
  )
}
