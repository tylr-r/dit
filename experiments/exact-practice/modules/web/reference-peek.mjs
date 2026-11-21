import { referencePattern } from './reference.mjs'

// The Contract owns tile content and keyboard activation. The web adapter supplies
// the pointer cancellation, hover capability, and per-pointer click information.
export function bindReferencePeek(doc, { open, reveal, signal }) {
  const win = doc.defaultView
  const options = { capture: true, signal }
  const hover = win.matchMedia('(hover: hover)')
  let active
  let consumed
  let showing = ''

  const tileAt = target => open() ? target?.closest?.('[data-reference-letter]') : null
  function show(tile) {
    const letter = tile?.getAttribute('data-reference-letter')
    const value = letter && tile.hasAttribute('data-peekable') ? letter + referencePattern(letter).replaceAll('.', '•').replaceAll('-', '—') : ''
    if (value !== showing) {
      showing = value
      if (!signal.aborted) reveal(value)
    }
  }
  function clearHold() {
    win.clearTimeout(active?.timer)
    active = undefined
  }
  function reset() {
    clearHold()
    consumed = undefined
    show(null)
  }
  function end(event) {
    if (!active || event.pointerId !== active.id) return
    clearHold()
    show(null)
  }

  doc.addEventListener('pointerover', event => {
    if (!active && event.pointerType === 'mouse' && hover.matches) show(tileAt(event.target))
  }, options)
  doc.addEventListener('pointerout', event => {
    const tile = tileAt(event.target)
    if (!tile || tile.contains(event.relatedTarget)) return
    if (active && event.pointerId !== active.id) return
    clearHold()
    show(null)
  }, options)
  doc.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return
    reset()
    const tile = tileAt(event.target)
    if (!tile) return
    if (event.pointerType === 'mouse' && hover.matches) show(tile)
    const id = event.pointerId
    active = { id, tile, timer: win.setTimeout(() => {
      if (!open() || !tile.isConnected) return reset()
      consumed = { tile, id }
      show(tile)
    }, 350) }
  }, options)
  doc.addEventListener('pointermove', event => {
    if (!active || event.pointerId !== active.id) return
    const hit = doc.elementFromPoint(event.clientX, event.clientY)
    if (!active.tile.contains(hit)) end(event)
  }, options)
  doc.addEventListener('pointerup', event => {
    const wasMouse = event.pointerType === 'mouse' && hover.matches
    end(event)
    if (wasMouse) show(tileAt(event.target))
  }, options)
  doc.addEventListener('pointercancel', end, options)
  doc.addEventListener('lostpointercapture', end, options)
  doc.addEventListener('contextmenu', event => {
    if (tileAt(event.target)) event.preventDefault()
  }, options)
  doc.addEventListener('click', event => {
    if (!consumed || event.detail === 0 || tileAt(event.target) !== consumed.tile) return
    if (event.pointerId != null && event.pointerId !== consumed.id) return
    consumed = undefined
    event.preventDefault()
    event.stopImmediatePropagation()
  }, options)
  win.addEventListener('blur', reset, { signal })
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) reset() }, options)
  signal.addEventListener('abort', reset, { once: true })
  return reset
}
