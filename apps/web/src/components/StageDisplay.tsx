import type { StageDisplayProps } from './componentProps'
import { ListenSineWave } from './ListenSineWave'

/** Main output area for freestyle, listen, and character modes. */
export function StageDisplay({
  freestyleDisplay,
  hasFreestyleDisplay,
  hintVisible,
  isFreestyle,
  isListen,
  letter,
  letterPlaceholder,
  listenDisplay,
  listenDisplayClass,
  listenStatus,
  listenStatusText,
  listenTtrText,
  listenWavePlayback,
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
          <div className="listen-visual">
            <ListenSineWave
              playback={listenWavePlayback}
              tintStatus={listenStatus}
            />
            {!letterPlaceholder ? (
              <div
                key={letter}
                className={`${listenDisplayClass} listen-overlay-letter`}
                aria-live="polite"
              >
                {listenDisplay}
              </div>
            ) : null}
          </div>
          <p
            key={`listen-status-${listenStatus}-${listenStatusText}`}
            className={`status-text listen-status-${listenStatus}`}
            aria-live="polite"
          >
            {listenStatusText}
          </p>
          {listenTtrText ? (
            <p
              key={`listen-ttr-${listenTtrText}`}
              className="wpm-text listen-ttr"
              aria-live="polite"
            >
              {listenTtrText}
            </p>
          ) : null}
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
