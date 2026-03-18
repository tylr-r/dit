import type { StageDisplayProps } from './componentProps'

/** Main output area for freestyle, listen, and character modes. */
export function StageDisplay({
  freestyleDisplay,
  hasFreestyleDisplay,
  hintVisible,
  isFreestyle,
  isListen,
  letter,
  listenDisplay,
  listenDisplayClass,
  listenStatusText,
  pips,
  practiceWord,
  practiceWordIndex,
  practiceWordMode,
  practiceWpmText,
  statusText,
  target,
}: StageDisplayProps) {
  const wordCharacters = practiceWord ? practiceWord.split('') : ['?']
  return (
    <main className="stage">
      {isFreestyle ? (
        <div
          className={`letter ${
            hasFreestyleDisplay ? '' : 'letter-placeholder'
          }`}
          aria-live="polite"
        >
          {freestyleDisplay}
        </div>
      ) : isListen ? (
        <>
          <div key={letter} className={listenDisplayClass} aria-live="polite">
            {listenDisplay}
          </div>
          <p className="status-text" aria-live="polite">
            {listenStatusText}
          </p>
        </>
      ) : (
        <>
          {practiceWordMode ? (
            <div
              key={practiceWord}
              className="word-display"
              aria-live="polite"
              aria-label={practiceWord ? `Word ${practiceWord}` : 'Word'}
            >
              {wordCharacters.map((char, index) => {
                const state =
                  index < practiceWordIndex
                    ? 'word-letter done'
                    : index === practiceWordIndex
                      ? 'word-letter active'
                      : 'word-letter'
                return (
                  <span key={`${char}-${index}`} className={state}>
                    {char}
                  </span>
                )
              })}
            </div>
          ) : (
            <div key={letter} className="letter">
              {letter}
            </div>
          )}
          {hintVisible ? (
            <div className="progress" aria-label={`Target ${target}`}>
              {pips}
            </div>
          ) : (
            <div className="progress progress-hidden" aria-hidden="true" />
          )}
          <p className="status-text" aria-live="polite">
            {statusText}
          </p>
          {practiceWpmText ? (
            <p className="wpm-text" aria-live="polite">
              {practiceWpmText}
            </p>
          ) : null}
        </>
      )}
    </main>
  )
}
