import type { Letter } from '@dit/core'
import { useMemo } from 'react'
import type { ListenControlsProps } from './componentProps'

const LISTEN_KEYBOARD_ROWS: readonly Letter[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

/** Listen mode controls: Play (replay) button plus an on-screen keyboard with unavailable keys dimmed. */
export function ListenControls({
  availableLetters,
  listenStatus,
  onReplay,
  onSubmitAnswer,
  showShortcutHints,
}: ListenControlsProps) {
  const isIdle = listenStatus === 'idle'
  const availableSet = useMemo(
    () => new Set(availableLetters),
    [availableLetters],
  )
  return (
    <div className="listen-controls">
      <button
        type="button"
        className="hint-button"
        onClick={onReplay}
        disabled={!isIdle}
        title={showShortcutHints ? 'Replay (Space)' : undefined}
      >
        Play
      </button>
      <div className="listen-keyboard" role="group" aria-label="Keyboard">
        {LISTEN_KEYBOARD_ROWS.map((row, rowIndex) => (
          <div className="keyboard-row" key={`row-${rowIndex}`}>
            {row.map((key) => {
              const isAvailable = availableSet.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={`keyboard-key${isAvailable ? '' : ' keyboard-key-unavailable'}`}
                  onClick={() => onSubmitAnswer(key)}
                  disabled={!isIdle || !isAvailable}
                  aria-label={
                    isAvailable
                      ? `Type ${key}`
                      : `${key} is not in this set`
                  }
                >
                  {key}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {showShortcutHints ? (
        <p className="listen-shortcut-hint" aria-hidden="true">
          Type the letter you hear, or press <kbd>Space</kbd> to replay
        </p>
      ) : null}
    </div>
  )
}
