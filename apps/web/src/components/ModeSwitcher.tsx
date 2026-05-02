import { useEffect, useRef, useState } from 'react'

export type ModeSwitcherMode = 'practice' | 'freestyle' | 'listen'

const MODES: ReadonlyArray<{
  value: ModeSwitcherMode
  label: string
  shortcut: string
}> = [
  { value: 'practice', label: 'Practice', shortcut: 'P' },
  { value: 'freestyle', label: 'Freestyle', shortcut: 'F' },
  { value: 'listen', label: 'Listen', shortcut: 'L' },
]

const SHORTCUT_TOOLTIP =
  'Switch mode — shortcuts: P Practice, F Freestyle, L Listen'

type ModeSwitcherProps = {
  mode: ModeSwitcherMode
  onChange: (next: ModeSwitcherMode) => void
  showShortcutHints: boolean
}

/**
 * Glass-pill mode switcher. Replaces the native `<select>` so the trigger
 * matches the rest of the top-bar glass treatment and the popover can show
 * keyboard shortcut affordances on devices that have a hardware keyboard.
 */
export function ModeSwitcher({
  mode,
  onChange,
  showShortcutHints,
}: ModeSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const currentIndex = Math.max(
    0,
    MODES.findIndex((m) => m.value === mode),
  )
  const current = MODES[currentIndex]

  useEffect(() => {
    if (open) popoverRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const select = (next: ModeSwitcherMode) => {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const openMenu = () => {
    setHighlightedIndex(currentIndex)
    setOpen(true)
  }

  const onTriggerClick = () => {
    if (open) {
      setOpen(false)
    } else {
      openMenu()
    }
  }

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu()
    }
  }

  const onPopoverKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        return
      case 'ArrowDown':
        event.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % MODES.length)
        return
      case 'ArrowUp':
        event.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + MODES.length) % MODES.length)
        return
      case 'Home':
        event.preventDefault()
        setHighlightedIndex(0)
        return
      case 'End':
        event.preventDefault()
        setHighlightedIndex(MODES.length - 1)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        select(MODES[highlightedIndex].value)
        return
      default:
        return
    }
  }

  return (
    <div className="mode-switcher">
      <button
        ref={triggerRef}
        type="button"
        className="mode-switcher-trigger"
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mode"
        title={showShortcutHints ? SHORTCUT_TOOLTIP : undefined}
        data-tour-target="modes"
      >
        <span className="mode-switcher-trigger-label">{current.label}</span>
        <span className="mode-switcher-trigger-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Mode"
          tabIndex={-1}
          className="mode-switcher-popover"
          onKeyDown={onPopoverKeyDown}
        >
          {MODES.map((m, idx) => (
            <button
              key={m.value}
              type="button"
              role="menuitemradio"
              aria-checked={m.value === mode}
              tabIndex={-1}
              className={`mode-switcher-option${
                m.value === mode ? ' mode-switcher-option--current' : ''
              }${idx === highlightedIndex ? ' mode-switcher-option--highlight' : ''}`}
              onClick={() => select(m.value)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <span className="mode-switcher-option-label">{m.label}</span>
              {showShortcutHints ? (
                <span
                  className="mode-switcher-option-shortcut"
                  aria-hidden="true"
                >
                  {m.shortcut}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
