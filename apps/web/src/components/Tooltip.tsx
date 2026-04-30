import type { ReactElement } from 'react'

type TooltipProps = {
  label: string
  shortcut?: string
  placement?: 'top' | 'bottom'
  /** Render the wrap as a full-width block so stretchy children keep their layout. */
  block?: boolean
  children: ReactElement
}

/**
 * Wraps a focusable element with a hover/focus tooltip that surfaces the
 * action label and an optional keyboard-shortcut chip. Uses CSS-driven
 * visibility so there is no JS state to manage; the wrapped element keeps
 * its own aria-label for screen readers.
 */
export function Tooltip({
  label,
  shortcut,
  placement = 'bottom',
  block = false,
  children,
}: TooltipProps) {
  return (
    <span
      className={`tooltip-wrap tooltip-wrap--${placement}${block ? ' tooltip-wrap--block' : ''}`}
    >
      {children}
      <span className="tooltip-bubble" role="tooltip">
        <span className="tooltip-label">{label}</span>
        {shortcut ? <kbd className="tooltip-kbd">{shortcut}</kbd> : null}
      </span>
    </span>
  )
}
