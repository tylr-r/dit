import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { logEvent, useScreenTracker } from '../lib/analytics'
import type { SettingsPanelProps } from './componentProps'

type SettingsSectionProps = {
  title?: string
  helper?: string
  isFirst?: boolean
  children: React.ReactNode
}

function SettingsSection({
  title,
  helper,
  isFirst = false,
  children,
}: SettingsSectionProps) {
  return (
    <section
      className={`settings-modal-section${isFirst ? ' settings-modal-section--first' : ''}`}
    >
      {title ? (
        <h3 className="settings-modal-section-title">{title}</h3>
      ) : null}
      {helper ? (
        <p className="settings-modal-section-helper">{helper}</p>
      ) : null}
      <div className="settings-modal-section-rows">{children}</div>
    </section>
  )
}

type SettingsRowProps = {
  label: React.ReactNode
  helper?: React.ReactNode
  control?: React.ReactNode
  htmlFor?: string
}

function SettingsRow({
  label,
  helper,
  control,
  htmlFor,
}: SettingsRowProps) {
  return (
    <div className="settings-modal-row">
      <div className="settings-modal-row-line">
        <label className="settings-modal-row-label" htmlFor={htmlFor}>
          {label}
        </label>
        {control ? (
          <div className="settings-modal-row-control">{control}</div>
        ) : null}
      </div>
      {helper ? (
        <p className="settings-modal-row-helper">{helper}</p>
      ) : null}
    </div>
  )
}

type SettingsToggleProps = {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}

function SettingsToggle({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: SettingsToggleProps) {
  return (
    <label
      className={`settings-modal-toggle${disabled ? ' settings-modal-toggle--disabled' : ''}`}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        className="settings-modal-toggle-input"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="settings-modal-toggle-track" aria-hidden="true">
        <span className="settings-modal-toggle-thumb" />
      </span>
    </label>
  )
}

type SettingsSliderProps = {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  valueDisplay?: string
  onChange: (next: number) => void
}

function SettingsSlider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  valueDisplay,
  onChange,
}: SettingsSliderProps) {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className="settings-modal-slider">
      <div className="settings-modal-slider-line">
        <label className="settings-modal-slider-label" htmlFor={id}>
          {label}
        </label>
        <span className="settings-modal-slider-value">
          {valueDisplay ?? value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="settings-modal-slider-input"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        style={{ '--slider-fill': `${percent}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

type SettingsButtonRowProps = {
  label: string
  value?: string
  helper?: string
  variant?: 'default' | 'quiet'
  disabled?: boolean
  trailing?: React.ReactNode
  onClick: () => void
}

function SettingsButtonRow({
  label,
  value,
  helper,
  variant = 'default',
  disabled = false,
  trailing,
  onClick,
}: SettingsButtonRowProps) {
  return (
    <div className="settings-modal-row">
      <button
        type="button"
        className={`settings-modal-button-row settings-modal-button-row--${variant}`}
        onClick={onClick}
        disabled={disabled}
      >
        <span className="settings-modal-button-row-label">{label}</span>
        <span className="settings-modal-button-row-trailing">
          {value ? (
            <span className="settings-modal-button-row-value">{value}</span>
          ) : null}
          {trailing ?? (
            <span className="settings-modal-button-row-chevron" aria-hidden="true">
              ›
            </span>
          )}
        </span>
      </button>
      {helper ? (
        <p className="settings-modal-row-helper">{helper}</p>
      ) : null}
    </div>
  )
}

/** Centered glass modal containing sectioned settings controls. */
export function SettingsPanel(props: SettingsPanelProps) {
  const { onClose } = props
  useScreenTracker('settings')

  const settingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({})
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => () => {
    Object.values(settingTimersRef.current).forEach((t) => {
      if (t) clearTimeout(t)
    })
  }, [])

  const reportSettingChange = useCallback(
    (
      setting: string,
      value: string | number | boolean,
      debounceMs: number = 0,
    ) => {
      const timers = settingTimersRef.current
      if (timers[setting]) {
        clearTimeout(timers[setting]!)
      }
      if (debounceMs === 0) {
        logEvent('setting_changed', { setting, value })
        return
      }
      timers[setting] = setTimeout(() => {
        logEvent('setting_changed', { setting, value })
        timers[setting] = undefined
      }, debounceMs)
    },
    [],
  )

  // ESC dismisses the modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus the modal on mount.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const handleBackdropClick = useCallback(() => {
    onClose()
  }, [onClose])

  // Stop clicks inside the dialog from bubbling to the backdrop.
  const stopPropagation = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
  }, [])

  // Suppress unused-prop/component warnings while sections are wired in later tasks.
  void props
  void reportSettingChange
  void SettingsSection
  void SettingsRow
  void SettingsToggle
  void SettingsSlider
  void SettingsButtonRow

  return (
    <div className="settings-modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="settings-modal"
        tabIndex={-1}
        onClick={stopPropagation}
      >
        <header className="settings-modal-header">
          <h2 id="settings-modal-title" className="settings-modal-title">
            Settings
          </h2>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="settings-modal-body">
          {/* sections wired in later tasks */}
        </div>
      </div>
    </div>
  )
}
