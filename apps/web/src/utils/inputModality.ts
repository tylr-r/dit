/**
 * Tracks whether the user's most recent input was keyboard or pointer. Used to
 * decide whether to restore focus to a trigger element when a modal/menu
 * closes: keyboard users expect focus restoration, but for mouse users it
 * leaves a focus ring on the trigger as soon as any subsequent shortcut key
 * fires the :focus-visible heuristic.
 */

type Modality = 'keyboard' | 'pointer'

let lastModality: Modality = 'pointer'
let initialized = false

export function initInputModalityTracking(): void {
  if (initialized || typeof document === 'undefined') return
  initialized = true
  document.addEventListener(
    'keydown',
    () => {
      lastModality = 'keyboard'
    },
    true,
  )
  document.addEventListener(
    'pointerdown',
    () => {
      lastModality = 'pointer'
    },
    true,
  )
}

export function isKeyboardModality(): boolean {
  return lastModality === 'keyboard'
}
