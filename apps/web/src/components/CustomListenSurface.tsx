import {
  customListenDiff,
  type DiffToken,
} from '@dit/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getPlaybackElapsedMs } from '../utils/tone'
import type {
  CustomListenPhase,
  CustomListenWorkflow,
} from '../hooks/useCustomListenSession'

export type CustomListenSurfaceProps = {
  phase: CustomListenPhase
  workflow: CustomListenWorkflow
  text: string
  typedCopy: string
  encodedCode: string
  /** Total playback duration in ms for the current saved text. */
  playDurationMs: number
  /** When true, render an on-screen keyboard instead of focusing the system keyboard. */
  useCustomKeyboard: boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onReveal: () => void
  onRestart: () => void
  onReplay: () => void
  onTypedCopyChange: (next: string) => void
  onEditText: () => void
  onClear: () => void
}

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const wordCount = (text: string) =>
  text.length === 0 ? 0 : text.trim().split(/\s+/).length

const renderTokens = (tokens: DiffToken[]) =>
  tokens.map((token, index) => (
    <span
      key={`${token.kind}-${index}-${token.text}`}
      className={`custom-diff-${token.kind}`}
    >
      {token.text}
    </span>
  ))

const TYPEALONG_KEYBOARD_ROWS: readonly string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

/** In-mode surface for custom-listen Setup / Playback / Reveal phases. */
export function CustomListenSurface({
  phase,
  workflow,
  text,
  typedCopy,
  encodedCode,
  playDurationMs,
  useCustomKeyboard,
  onPlay,
  onPause,
  onResume,
  onReveal,
  onRestart,
  onReplay,
  onTypedCopyChange,
  onEditText,
  onClear,
}: CustomListenSurfaceProps) {
  const isTypeAlong = workflow === 'typealong'
  const typedCopyRef = useRef<HTMLTextAreaElement | null>(null)
  const progressBarRef = useRef<HTMLSpanElement | null>(null)
  const elapsedTextRef = useRef<HTMLSpanElement | null>(null)
  const progressBarOuterRef = useRef<HTMLDivElement | null>(null)
  const audioEndedRef = useRef(false)
  const [audioEnded, setAudioEnded] = useState(false)

  // Keep the ref in sync whenever the state flips.
  useEffect(() => {
    audioEndedRef.current = audioEnded
  }, [audioEnded])

  // Auto-focus the type-along when playback begins (skip on touch devices that use the on-screen keyboard).
  useEffect(() => {
    if (phase === 'playing' && isTypeAlong && !useCustomKeyboard) {
      typedCopyRef.current?.focus()
    }
  }, [phase, isTypeAlong, useCustomKeyboard])

  // RAF loop that drives the progress bar during playback.
  // Reads elapsed time from the AudioContext clock via getPlaybackElapsedMs(),
  // which freezes automatically during suspend and resumes correctly on resume.
  // Writes directly to DOM refs each frame to avoid React batching/deferral.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'paused') {
      // Reset visuals when not in active playback.
      if (progressBarRef.current) progressBarRef.current.style.width = '0%'
      if (elapsedTextRef.current) elapsedTextRef.current.textContent = '0:00'
      if (progressBarOuterRef.current) {
        progressBarOuterRef.current.setAttribute('aria-valuenow', '0')
      }
      audioEndedRef.current = false
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets animation state synchronously when playback stops; no external subscription involved
      if (audioEnded) setAudioEnded(false)
      return
    }
    let frame = 0
    const tick = () => {
      const raw = getPlaybackElapsedMs()
      const next = raw === null ? 0 : Math.min(raw, playDurationMs)
      const ratio = playDurationMs > 0 ? Math.min(1, next / playDurationMs) : 0
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${(ratio * 100).toFixed(2)}%`
      }
      if (elapsedTextRef.current) {
        elapsedTextRef.current.textContent = formatTime(next)
      }
      if (progressBarOuterRef.current) {
        progressBarOuterRef.current.setAttribute('aria-valuenow', String(Math.round(next)))
      }
      const ended = phase === 'playing' && playDurationMs > 0 && next >= playDurationMs
      if (ended !== audioEndedRef.current) {
        audioEndedRef.current = ended
        setAudioEnded(ended)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- audioEnded is intentionally excluded; the ref (audioEndedRef) is used for comparison to avoid restarting the RAF loop on every state flip
  }, [phase, playDurationMs])

  const diff = useMemo(() => {
    if (phase !== 'reveal' || !isTypeAlong) return null
    return customListenDiff(text, typedCopy.toUpperCase())
  }, [phase, isTypeAlong, text, typedCopy])

  const isActive = phase === 'playing' || phase === 'paused'

  return (
    <section className="custom-listen-surface" aria-live="polite">
      <span
        className={`custom-listen-chip${isTypeAlong ? ' custom-listen-chip-typealong' : ' custom-listen-chip-listenonly'}`}
      >
        <span className="custom-listen-chip-dot" aria-hidden="true" />
        {isTypeAlong ? 'Custom · Type along' : 'Custom · Listen only'}
      </span>

      {phase === 'setup' ? (
        <div className="custom-listen-source-hidden">
          <div className="custom-listen-lock" aria-hidden="true">
            ⏷
          </div>
          <div className="custom-listen-source-summary">
            {text.length} chars · {wordCount(text)} words ready
          </div>
          <div className="custom-listen-source-sub">
            Hidden until you Reveal
          </div>
        </div>
      ) : null}

      {isActive ? (
        <>
          <div
            ref={progressBarOuterRef}
            className="custom-listen-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.round(playDurationMs)}
            aria-valuenow={0}
          >
            <span ref={progressBarRef} style={{ width: '0%' }} />
          </div>
          <div className="custom-listen-progress-time">
            <span ref={elapsedTextRef}>0:00</span>
            <span>{formatTime(playDurationMs)}</span>
          </div>
        </>
      ) : null}

      {(phase === 'setup' || isActive) && isTypeAlong ? (
        <>
          <span className="custom-listen-typealong-label">
            Type along {phase === 'setup' ? '(optional)' : ''}
          </span>
          <textarea
            ref={typedCopyRef}
            className="custom-listen-typealong"
            value={typedCopy}
            onChange={(event) => onTypedCopyChange(event.target.value)}
            disabled={phase === 'setup' || phase === 'paused'}
            readOnly={useCustomKeyboard}
            inputMode={useCustomKeyboard ? 'none' : undefined}
            placeholder={
              phase === 'setup'
                ? 'Press Play, then type as you hear it.'
                : 'Type as you hear it.'
            }
            aria-label="Type along"
          />
          {isTypeAlong && useCustomKeyboard && (phase === 'playing' || phase === 'paused') ? (
            <div className="custom-listen-keyboard" role="group" aria-label="Type along keyboard">
              {TYPEALONG_KEYBOARD_ROWS.map((row, rowIndex) => (
                <div className="keyboard-row" key={`row-${rowIndex}`}>
                  {row.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="keyboard-key"
                      onClick={() => onTypedCopyChange(typedCopy + key)}
                      disabled={phase === 'paused'}
                      aria-label={`Type ${key}`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ))}
              <div className="keyboard-row keyboard-row-fn">
                <button
                  type="button"
                  className="keyboard-key keyboard-key-wide"
                  onClick={() => onTypedCopyChange(typedCopy + ' ')}
                  disabled={phase === 'paused'}
                  aria-label="Space"
                >
                  Space
                </button>
                <button
                  type="button"
                  className="keyboard-key"
                  onClick={() => onTypedCopyChange(typedCopy.slice(0, -1))}
                  disabled={phase === 'paused' || typedCopy.length === 0}
                  aria-label="Backspace"
                >
                  ⌫
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {phase === 'reveal' ? (
        <div className="custom-listen-reveal">
          <div className="custom-listen-diff-row">
            <span className="custom-listen-diff-label">
              {isTypeAlong ? 'Source' : 'What was sent'}
            </span>
            <div className="custom-listen-diff-text">{text}</div>
          </div>
          {isTypeAlong && diff ? (
            <>
              <div className="custom-listen-diff-row">
                <span className="custom-listen-diff-label">Your copy</span>
                <div className="custom-listen-diff-text">
                  {renderTokens(diff.tokens)}
                </div>
              </div>
              <div className="custom-listen-diff-summary">
                <span className="custom-listen-pill">
                  <span className="custom-listen-pill-num">
                    {diff.matched}
                  </span>
                  /{diff.total} matched
                </span>
                <span className="custom-listen-pill">
                  <span className="custom-listen-pill-num">{diff.missed}</span>{' '}
                  missed
                </span>
                <span className="custom-listen-pill">
                  <span className="custom-listen-pill-num">{diff.extra}</span>{' '}
                  extra
                </span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="custom-listen-actions">
        {phase === 'setup' ? (
          <button
            type="button"
            className="hint-button submit-button"
            onClick={onPlay}
          >
            Play
          </button>
        ) : null}
        {phase === 'playing' && !audioEnded ? (
          <>
            <button
              type="button"
              className="hint-button submit-button"
              onClick={onPause}
            >
              Pause
            </button>
            <button
              type="button"
              className="hint-button"
              onClick={onRestart}
            >
              Restart
            </button>
            <button
              type="button"
              className="hint-button"
              onClick={onReveal}
            >
              End
            </button>
          </>
        ) : null}
        {phase === 'playing' && audioEnded ? (
          <button
            type="button"
            className="hint-button submit-button"
            onClick={onReveal}
          >
            Reveal
          </button>
        ) : null}
        {phase === 'paused' ? (
          <>
            <button
              type="button"
              className="hint-button submit-button"
              onClick={onResume}
            >
              Resume
            </button>
            <button
              type="button"
              className="hint-button"
              onClick={onRestart}
            >
              Restart
            </button>
            <button
              type="button"
              className="hint-button"
              onClick={onReveal}
            >
              End
            </button>
          </>
        ) : null}
        {phase === 'reveal' ? (
          <>
            <button
              type="button"
              className="hint-button submit-button"
              onClick={onReplay}
            >
              Replay
            </button>
            <button
              type="button"
              className="hint-button"
              onClick={onEditText}
            >
              New text
            </button>
          </>
        ) : null}
      </div>

      {phase === 'setup' || phase === 'reveal' ? (
        <div className="custom-listen-secondary">
          <button type="button" onClick={onEditText}>
            Edit text
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={onClear}>
            {phase === 'reveal' ? 'Done' : 'Clear'}
          </button>
        </div>
      ) : null}

      <div className="custom-listen-debug" aria-hidden="true" data-code={encodedCode} />
    </section>
  )
}
