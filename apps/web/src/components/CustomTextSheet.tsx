import {
  getListenPlaybackDurationMs,
  getListenTiming,
  LISTEN_MIN_UNIT_MS,
  textToMorseCode,
} from '@dit/core'
import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_CHARS = 2000

export type CustomTextSheetProps = {
  initialText: string
  initialTypeAlong: boolean
  characterWpm: number
  effectiveWpm: number
  onClose: () => void
  onSave: (input: { text: string; typeAlong: boolean }) => void
}

const formatDuration = (ms: number) => {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Bottom sheet for entering or editing the custom-listen passage. */
export function CustomTextSheet({
  initialText,
  initialTypeAlong,
  characterWpm,
  effectiveWpm,
  onClose,
  onSave,
}: CustomTextSheetProps) {
  const [draft, setDraft] = useState(initialText)
  const [typeAlong, setTypeAlong] = useState(initialTypeAlong)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const encoded = useMemo(
    () => textToMorseCode(draft, { maxChars: MAX_CHARS }),
    [draft],
  )

  const timing = useMemo(
    () => getListenTiming(characterWpm, effectiveWpm, LISTEN_MIN_UNIT_MS),
    [characterWpm, effectiveWpm],
  )

  const duration = useMemo(
    () =>
      getListenPlaybackDurationMs(
        encoded.code,
        timing.unitMs,
        timing.interCharacterGapMs,
      ),
    [encoded.code, timing.unitMs, timing.interCharacterGapMs],
  )

  const handleSave = () => {
    onSave({ text: draft, typeAlong })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal custom-text-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Custom text"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="custom-text-grabber" aria-hidden="true" />
        <h2 className="custom-text-title">Custom text</h2>
        <p className="custom-text-help">
          Paste or type a passage. Dit will play it as Morse so you can copy in
          your head, or on paper. Letters, numbers, and spaces only. Leave
          blank and Save to return to normal Listen.
        </p>
        <textarea
          ref={textareaRef}
          className="custom-text-textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Paste text here…"
          aria-label="Custom text passage"
        />
        <div className="custom-text-meta">
          <span>
            <strong>{encoded.normalized.length}</strong> / {MAX_CHARS} chars
          </span>
          <span>Ignored: {encoded.ignored}</span>
          <span>~{formatDuration(duration)} at {characterWpm} WPM</span>
        </div>
        <div className="custom-text-toggle">
          <div className="custom-text-toggle-text">
            <span className="custom-text-toggle-title">Type along</span>
            <span className="custom-text-toggle-help">
              Show a textarea during playback. Off plays the audio only — for
              paper or head copy.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={typeAlong}
            aria-label="Type along"
            className={`custom-text-switch${typeAlong ? ' custom-text-switch-on' : ''}`}
            onClick={() => setTypeAlong((prev) => !prev)}
          />
        </div>
        <div className="custom-text-actions">
          <button
            type="button"
            className="custom-text-action custom-text-action-ghost"
            onClick={onClose}
          >
            Discard
          </button>
          <button
            type="button"
            className="custom-text-action custom-text-action-primary"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
