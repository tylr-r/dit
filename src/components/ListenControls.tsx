import type { Letter } from '../data/morse'

const LISTEN_KEYBOARD_ROWS: readonly Letter[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

type ListenControlsProps = {
  listenStatus: 'idle' | 'success' | 'error'
  onReplay: () => void
  onSubmitAnswer: (value: Letter) => void
  useCustomKeyboard: boolean
}

/** Listen mode controls with optional on-screen keyboard. */
export function ListenControls({
  listenStatus,
  onReplay,
  onSubmitAnswer,
  useCustomKeyboard,
}: ListenControlsProps) {
  const isIdle = listenStatus === 'idle'
  return (
    <div
      className={`listen-controls${
        useCustomKeyboard ? ' listen-controls-custom' : ''
      }`}
    >
      <button
        type="button"
        className="hint-button"
        onClick={onReplay}
        disabled={!isIdle}
      >
        Play
      </button>
      {useCustomKeyboard ? (
        <div className="listen-keyboard" role="group" aria-label="Keyboard">
          {LISTEN_KEYBOARD_ROWS.map((row, rowIndex) => (
            <div className="keyboard-row" key={`row-${rowIndex}`}>
              {row.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="keyboard-key"
                  onClick={() => onSubmitAnswer(key)}
                  disabled={!isIdle}
                  aria-label={`Type ${key}`}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
