import type {
  KeyboardEvent,
  PointerEvent,
  RefObject,
  SyntheticEvent,
} from 'react'

type MorseButtonProps = {
  buttonRef: RefObject<HTMLButtonElement | null>
  isPressing: boolean
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => void
  onPointerCancel: () => void
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerLeave: () => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
}

/** Tap/press input button for dot/dash entry. */
export function MorseButton({
  buttonRef,
  isPressing,
  onBlur,
  onKeyDown,
  onKeyUp,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerUp,
}: MorseButtonProps) {
  const preventDefault = (event: SyntheticEvent) => {
    event.preventDefault()
  }

  return (
    <button
      type="button"
      className={`morse-button ${isPressing ? 'pressing' : ''}`}
      ref={buttonRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onContextMenu={preventDefault}
      onDoubleClick={preventDefault}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      aria-label="Tap for dot, hold for dash"
    >
      <span className="button-content" aria-hidden="true">
        <span className="signal dot" />
        <span className="signal dash" />
        <span className="signal dot" />
      </span>
    </button>
  )
}
