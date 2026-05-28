export type KeyboardMorseSymbol = '.' | '-'

type KeyboardMorseEvent = Pick<KeyboardEvent, 'code' | 'key'>

export function getKeyboardMorseSymbol(
  event: KeyboardMorseEvent,
): KeyboardMorseSymbol | null {
  switch (event.code) {
    case 'ControlLeft':
    case 'BracketLeft':
      return '.'
    case 'ControlRight':
    case 'BracketRight':
      return '-'
  }

  if (event.key === '[') {
    return '.'
  }
  if (event.key === ']') {
    return '-'
  }

  return null
}

export function isVbandControlKey(event: KeyboardMorseEvent): boolean {
  return event.key === 'Control' && (
    event.code === 'ControlLeft' ||
    event.code === 'ControlRight'
  )
}
