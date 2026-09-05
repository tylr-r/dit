import type { StageDisplayProps } from './componentProps'
import { ListenSineWave } from './ListenSineWave'

/** Main output area for freestyle, listen, and character modes. */
export function StageDisplay({
  freestyleDisplay,
  hasFreestyleDisplay,
  freestyleToneActive,
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
  customListenPlayback,
  customListenClockSource,
  hideListenAnswer = false,
  pips,
  practiceWord,
  practiceWordIndex,
  practiceWordMode,
  practiceWpmText,
  statusText,
  target,
}: StageDisplayProps) {
  const wordCharacters = practiceWord ? practiceWord.split('') : ['?']
  const freestylePatternVisible =
    hasFreestyleDisplay && /^[.-]+$/.test(freestyleDisplay)
  const showFreestyleOverlayLetter =
    hasFreestyleDisplay &&
    freestyleDisplay !== '?' &&
    !freestylePatternVisible
  return (
    <main className="stage">
      {isFreestyle ? (
        <div className="listen-visual freestyle-visual">
          <ListenSineWave playback={null} liveActive={freestyleToneActive} />
          {showFreestyleOverlayLetter ? (
            <div
              key={freestyleDisplay}
              className="listen-overlay-letter freestyle-overlay-letter"
              aria-live="polite"
            >
              {freestyleDisplay}
            </div>
          ) : null}
        </div>
      ) : isListen ? (
        customListenPlayback !== null || hideListenAnswer ? (
          <div className="listen-visual">
            <ListenSineWave playback={customListenPlayback} clockSource={customListenClockSource} />
          </div>
        ) : (
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
            <p
              key={`listen-ttr-${listenTtrText ?? 'empty'}`}
              className="wpm-text listen-ttr"
              aria-live="polite"
            >
              {listenTtrText ?? ' '}
            </p>
          </>
        )
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
