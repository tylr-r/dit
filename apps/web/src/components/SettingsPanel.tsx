import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
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

type SettingsDestructiveButtonProps = {
  label: string
  confirmingLabel: string
  confirmingHelper: string
  loadingLabel?: string
  disabled?: boolean
  onConfirm: () => void
}

function SettingsDestructiveButton({
  label,
  confirmingLabel,
  confirmingHelper,
  loadingLabel,
  disabled = false,
  onConfirm,
}: SettingsDestructiveButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="settings-modal-destructive-confirm">
        <p className="settings-modal-destructive-helper">{confirmingHelper}</p>
        <div className="settings-modal-destructive-actions">
          <button
            type="button"
            className="settings-modal-destructive-cancel"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="settings-modal-destructive settings-modal-destructive--confirming"
            onClick={() => {
              setConfirming(false)
              onConfirm()
            }}
          >
            {confirmingLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="settings-modal-destructive"
      onClick={() => setConfirming(true)}
      disabled={disabled}
    >
      {loadingLabel ?? label}
    </button>
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
          <SettingsSection title="Helpers" isFirst>
            <SettingsRow
              label="Show hints"
              helper="Show the dit/dah pattern under the prompt letter."
              control={
                <SettingsToggle
                  id="setting-show-hint"
                  label="Show hints"
                  checked={props.showHint}
                  disabled={props.isFreestyle}
                  onChange={(next) => {
                    reportSettingChange('show_hint', next)
                    props.onShowHintChange(next)
                  }}
                />
              }
            />
            <SettingsRow
              label="Show mnemonics"
              helper="Show the memory phrase below the prompt letter."
              control={
                <SettingsToggle
                  id="setting-show-mnemonic"
                  label="Show mnemonics"
                  checked={props.showMnemonic}
                  disabled={props.isFreestyle}
                  onChange={(next) => {
                    reportSettingChange('show_mnemonic', next)
                    props.onShowMnemonicChange(next)
                  }}
                />
              }
            />
          </SettingsSection>

          <SettingsSection title="Learning">
            <SettingsButtonRow
              label="Learning method"
              value={props.guidedCourseActive ? 'Course' : 'Open practice'}
              onClick={() => {
                props.onShowLearning()
              }}
            />
          </SettingsSection>

          <SettingsSection
            title="Practice"
            helper={
              props.isPractice
                ? undefined
                : 'Applies when you switch back to Practice mode.'
            }
          >
            <SettingsRow
              label="Practice Words"
              helper={
                props.guidedCourseActive && props.isPractice
                  ? 'Unavailable while the guided beginner course is active.'
                  : 'Practice full words instead of single characters.'
              }
              control={
                <SettingsToggle
                  id="setting-practice-words"
                  label="Practice Words"
                  checked={props.practiceWordMode}
                  disabled={props.guidedCourseActive && props.isPractice}
                  onChange={(next) => {
                    reportSettingChange('practice_word_mode', next)
                    props.onPracticeWordModeChange(next)
                  }}
                />
              }
            />
            <SettingsRow
              label="Auto-play sound"
              helper="Automatically plays the current Practice target."
              control={
                <SettingsToggle
                  id="setting-practice-auto-play"
                  label="Auto-play sound"
                  checked={props.practiceAutoPlay}
                  onChange={(next) => {
                    reportSettingChange('practice_auto_play', next)
                    props.onPracticeAutoPlayChange(next)
                  }}
                />
              }
            />
            {!props.guidedCourseActive ? (
              <SettingsRow
                label="Sequential order"
                helper="Cycle through letters in order instead of randomly."
                control={
                  <SettingsToggle
                    id="setting-practice-learn-mode"
                    label="Sequential order"
                    checked={props.practiceLearnMode}
                    disabled={props.practiceWordMode}
                    onChange={(next) => {
                      reportSettingChange('practice_learn_mode', next)
                      props.onPracticeLearnModeChange(next)
                    }}
                  />
                }
              />
            ) : null}
            <SettingsRow
              label="Immediate flow recovery"
              helper="When you miss, immediately replay the same letter."
              control={
                <SettingsToggle
                  id="setting-practice-ifr-mode"
                  label="Immediate flow recovery"
                  checked={props.practiceIfrMode}
                  onChange={(next) => {
                    reportSettingChange('practice_ifr_mode', next)
                    props.onPracticeIfrModeChange(next)
                  }}
                />
              }
            />
            <SettingsRow
              label="Review misses later"
              helper="Re-queue letters you miss so they come back soon."
              control={
                <SettingsToggle
                  id="setting-practice-review-misses"
                  label="Review misses later"
                  checked={props.practiceReviewMisses}
                  disabled={!props.practiceIfrMode}
                  onChange={(next) => {
                    reportSettingChange('practice_review_misses', next)
                    props.onPracticeReviewMissesChange(next)
                  }}
                />
              }
            />
          </SettingsSection>

          <SettingsSection
            title="Listen"
            helper={props.isListen ? undefined : 'Applies in Listen mode.'}
          >
            <SettingsSlider
              id="setting-listen-wpm"
              label="Listen WPM"
              value={props.listenWpm}
              min={props.listenWpmMin}
              max={props.listenWpmMax}
              valueDisplay={`${props.listenWpm}`}
              onChange={(next) => {
                reportSettingChange('listen_wpm', next, 500)
                props.onListenWpmChange(next)
              }}
            />
            <SettingsButtonRow
              label="Use recommended settings"
              onClick={() => props.onUseRecommended()}
            />
          </SettingsSection>

          <SettingsSection title="Audio">
            <SettingsSlider
              id="setting-tone-frequency"
              label="Tone frequency"
              value={props.toneFrequency}
              min={props.toneFrequencyMin}
              max={props.toneFrequencyMax}
              step={props.toneFrequencyStep}
              valueDisplay={`${props.toneFrequency} Hz`}
              onChange={(next) => {
                reportSettingChange('tone_frequency', next, 500)
                props.onToneFrequencyChange(next)
              }}
            />
            <SettingsButtonRow
              label="Sound check"
              disabled={props.soundCheckStatus === 'playing'}
              onClick={() => props.onSoundCheck()}
              trailing={
                <span
                  className={`settings-modal-test-pill${
                    props.soundCheckStatus === 'playing' ? ' settings-modal-test-pill--playing' : ''
                  }`}
                >
                  {props.soundCheckStatus === 'playing' ? 'Playing' : 'Test'}
                </span>
              }
            />
          </SettingsSection>

          {/* Footer actions: utility links, no section header */}
          <div className="settings-modal-footer-actions">
            <SettingsButtonRow
              label="About Dit"
              variant="quiet"
              onClick={() => props.onShowAbout()}
            />
            {props.onReplayNux ? (
              <SettingsButtonRow
                label="Replay onboarding"
                variant="quiet"
                onClick={() => props.onReplayNux!()}
              />
            ) : null}
          </div>

          <SettingsSection title="Account">
            {props.user ? (
              <>
                <div className="settings-modal-identity">
                  <span className="settings-modal-identity-avatar" aria-hidden="true">
                    {props.userInitial}
                  </span>
                  <span className="settings-modal-identity-label">{props.userLabel}</span>
                </div>
                <SettingsButtonRow
                  label={props.isDeletingAccount ? 'Deleting…' : 'Sign out'}
                  disabled={!props.authReady || props.isDeletingAccount}
                  onClick={() => props.onSignOut()}
                />
                <SettingsDestructiveButton
                  label="Delete account"
                  confirmingLabel="Delete account"
                  confirmingHelper="Permanently delete your account and all synced data?"
                  disabled={!props.authReady || props.isDeletingAccount}
                  loadingLabel={props.isDeletingAccount ? 'Deleting…' : undefined}
                  onConfirm={() => props.onDeleteAccount()}
                />
              </>
            ) : (
              <SettingsButtonRow
                label="Sign in"
                disabled={!props.authReady}
                onClick={() => props.onShowSignIn()}
              />
            )}
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
