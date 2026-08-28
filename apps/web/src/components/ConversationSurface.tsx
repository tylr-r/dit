import {
  customListenDiff,
  getReceivedTextAtElapsedMs,
  type DiffToken,
} from '@dit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MorseButton } from './MorseButton'
import type {
  ConversationPhase,
  ConversationStartDirection,
  ConversationTurn,
} from '../hooks/useConversationSession'

export type ConversationSurfaceProps = {
  phase: ConversationPhase
  turns: ConversationTurn[]
  incomingText: string
  incomingCode: string
  playUnitMs: number
  playInterCharacterGapMs: number
  typedCopy: string
  copyWasChecked: boolean
  draft: string
  isKeying: boolean
  replyStarted: boolean
  errorMessage: string | null
  playDurationMs: number
  getPlaybackElapsedMs: () => number | null
  showShortcutHints: boolean
  onStart: (direction: ConversationStartDirection) => void
  onSendReply: () => void
  onPause: () => void
  onResume: () => void
  onReplay: () => void
  onEnd: () => void
  onNewQso: () => void
  onRetry: () => void
  onCheckCopy: () => void
  onSkipCopy: () => void
  onTypedCopyChange: (next: string) => void
  onKeyPressIn: () => void
  onKeyPressOut: () => void
  onDraftBackspace: () => void
  onDraftClear: () => void
}

const formatPlaybackTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const renderCopyTokens = (tokens: DiffToken[]) =>
  tokens.map((token, index) => (
    <span
      key={`${token.kind}-${index}-${token.text}`}
      className={`custom-diff-${token.kind}`}
    >
      {token.text}
    </span>
  ))

const TurnList = ({
  turns,
  revealedTheirTurns,
  onRevealTurn,
}: {
  turns: ConversationTurn[]
  revealedTheirTurns: ReadonlySet<ConversationTurn>
  onRevealTurn: (turn: ConversationTurn) => void
}) => {
  const historyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const history = historyRef.current
    if (history) {
      history.scrollTop = history.scrollHeight
    }
  }, [turns])

  return turns.length === 0 ? null : (
    <div
      ref={historyRef}
      className="conversation-transcript"
      role="region"
      aria-label="Conversation history"
      aria-live="polite"
    >
      {turns.map((turn, index) => {
        const messageIsConcealed =
          turn.speaker === 'them' && !revealedTheirTurns.has(turn)
        return (
          <div
            key={`${index}-${turn.speaker}`}
            className={`conversation-turn conversation-turn-${turn.speaker}`}
          >
            <span className="conversation-turn-label">
              {turn.speaker === 'them' ? 'Them' : 'You'}
            </span>
            {messageIsConcealed ? (
              <button
                type="button"
                className="conversation-turn-reveal"
                onClick={() => onRevealTurn(turn)}
              >
                Reveal message
              </button>
            ) : (
              <span className="conversation-turn-text">{turn.text}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const PROSIGNS = [
  { name: 'K', meaning: 'Go ahead' },
  { name: 'KN', meaning: 'Named station only' },
  { name: 'BK', meaning: 'Quick handoff' },
  { name: 'AR', meaning: 'End of message' },
  { name: 'SK', meaning: 'End of contact' },
  { name: 'BT', meaning: 'Separator' },
  { name: 'AS', meaning: 'Wait' },
  { name: 'HH', meaning: 'Correction' },
]

const ProsignReference = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside
      id="conversation-prosign-reference"
      className="conversation-prosign-sheet"
      role="dialog"
      aria-modal="false"
      aria-label="Prosign reference"
    >
      <header className="conversation-prosign-header">
        <div>
          <span>Reference</span>
          <h2>Prosigns</h2>
        </div>
      </header>
      <div className="conversation-prosign-list">
        {PROSIGNS.map((prosign) => (
          <div key={prosign.name} className="conversation-prosign-row">
            <strong>{prosign.name}</strong>
            <span>{prosign.meaning}</span>
          </div>
        ))}
      </div>
      <p className="conversation-prosign-note">
        Prosigns are sent as a single continuous character.
      </p>
    </aside>
  )
}

/** In-mode surface for the Conversation phases: idle setup, LLM turn playback, and keyed replies. */
export function ConversationSurface({
  phase,
  turns,
  incomingText,
  incomingCode,
  playUnitMs,
  playInterCharacterGapMs,
  typedCopy,
  copyWasChecked,
  draft,
  isKeying,
  replyStarted,
  errorMessage,
  playDurationMs,
  getPlaybackElapsedMs,
  showShortcutHints,
  onStart,
  onSendReply,
  onPause,
  onResume,
  onReplay,
  onEnd,
  onNewQso,
  onRetry,
  onCheckCopy,
  onSkipCopy,
  onTypedCopyChange,
  onKeyPressIn,
  onKeyPressOut,
  onDraftBackspace,
  onDraftClear,
}: ConversationSurfaceProps) {
  const [playbackStalled, setPlaybackStalled] = useState(false)
  const [showLiveLetters, setShowLiveLetters] = useState(false)
  const [revealedTheirTurns, setRevealedTheirTurns] = useState<
    Set<ConversationTurn>
  >(() => new Set())
  const [expandedCopyTurnCount, setExpandedCopyTurnCount] = useState<
    number | null
  >(null)
  const [collapsedCopyTurnCount, setCollapsedCopyTurnCount] = useState<
    number | null
  >(null)
  const [showProsigns, setShowProsigns] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const pressActiveRef = useRef(false)
  const progressBarRef = useRef<HTMLSpanElement | null>(null)
  const progressBarOuterRef = useRef<HTMLDivElement | null>(null)
  const elapsedTextRef = useRef<HTMLSpanElement | null>(null)
  const typedCopyRef = useRef<HTMLTextAreaElement | null>(null)
  const liveLettersRef = useRef<HTMLDivElement | null>(null)

  const lastTheirTurn = useMemo(
    () => turns.slice().reverse().find((turn) => turn.speaker === 'them') ?? null,
    [turns],
  )
  const copyDiff = useMemo(
    () =>
      lastTheirTurn
        ? customListenDiff(lastTheirTurn.text, typedCopy.toUpperCase())
        : null,
    [lastTheirTurn, typedCopy],
  )
  const copyExpanded =
    collapsedCopyTurnCount !== turns.length &&
    (expandedCopyTurnCount === turns.length || typedCopy.trim().length > 0)

  const revealTheirTurn = useCallback((turn: ConversationTurn) => {
    setRevealedTheirTurns((current) => {
      if (current.has(turn)) return current
      const next = new Set(current)
      next.add(turn)
      return next
    })
  }, [])

  const visibleTheirTurns = useMemo(() => {
    const visible = new Set(revealedTheirTurns)
    if (
      lastTheirTurn &&
      ((phase === 'your-turn' && (showLiveLetters || replyStarted)) ||
        copyWasChecked)
    ) {
      visible.add(lastTheirTurn)
    }
    return visible
  }, [
    copyWasChecked,
    lastTheirTurn,
    phase,
    replyStarted,
    revealedTheirTurns,
    showLiveLetters,
  ])

  useEffect(() => {
    if (phase === 'their-turn-playing') {
      typedCopyRef.current?.focus()
    }
  }, [phase])

  useEffect(() => {
    const playbackActive =
      phase === 'their-turn-playing' || phase === 'their-turn-paused'
    if (!playbackActive) return

    let frame = 0
    let firstFrameTime: number | null = null
    let lastElapsed = 0
    const tick = (frameTime: number) => {
      firstFrameTime ??= frameTime
      const elapsed = Math.min(
        getPlaybackElapsedMs() ?? 0,
        playDurationMs,
      )
      if (elapsed > lastElapsed + 20) {
        lastElapsed = elapsed
        setPlaybackStalled(false)
      } else if (
        phase === 'their-turn-playing' &&
        elapsed === 0 &&
        frameTime - firstFrameTime > 1500
      ) {
        setPlaybackStalled(true)
      }
      const progress = playDurationMs > 0 ? elapsed / playDurationMs : 0
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${(progress * 100).toFixed(2)}%`
      }
      if (elapsedTextRef.current) {
        elapsedTextRef.current.textContent = formatPlaybackTime(elapsed)
      }
      if (liveLettersRef.current) {
        liveLettersRef.current.textContent = getReceivedTextAtElapsedMs(
          incomingText,
          incomingCode,
          playUnitMs,
          elapsed,
          playInterCharacterGapMs,
        )
      }
      progressBarOuterRef.current?.setAttribute(
        'aria-valuenow',
        String(Math.round(elapsed)),
      )
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [
    getPlaybackElapsedMs,
    incomingCode,
    incomingText,
    phase,
    playDurationMs,
    playInterCharacterGapMs,
    playUnitMs,
  ])

  const handleEnableSound = () => {
    setPlaybackStalled(false)
    onReplay()
  }

  const handlePointerDown = () => {
    if (pressActiveRef.current) return
    pressActiveRef.current = true
    if (phase === 'your-turn' && lastTheirTurn) {
      revealTheirTurn(lastTheirTurn)
    }
    onKeyPressIn()
  }
  const handlePointerEnd = () => {
    if (!pressActiveRef.current) return
    pressActiveRef.current = false
    onKeyPressOut()
  }

  return (
    <section
      className={`conversation-surface${
        showProsigns ? ' conversation-surface-with-prosigns' : ''
      }`}
      aria-live="polite"
    >
      {phase !== 'idle' ? (
        <button
          type="button"
          className={`conversation-prosign-trigger${
            showProsigns ? ' conversation-prosign-trigger-open' : ''
          }`}
          aria-controls="conversation-prosign-reference"
          aria-expanded={showProsigns}
          onClick={() => setShowProsigns((current) => !current)}
        >
          Prosigns
        </button>
      ) : null}
      {showProsigns ? (
        <ProsignReference onClose={() => setShowProsigns(false)} />
      ) : null}
      {phase === 'idle' ? (
        <div
          className="conversation-idle"
        >
          <p id="conversation-start-question" className="conversation-start-question">
            Do you want to send or receive first?
          </p>
          <div
            className="conversation-start-actions"
            role="group"
            aria-labelledby="conversation-start-question"
          >
            <button
              type="button"
              className="conversation-start-button"
              onClick={() => onStart('send')}
            >
              Send first
            </button>
            <button
              type="button"
              className="conversation-start-button"
              onClick={() => onStart('receive')}
            >
              Receive first
            </button>
          </div>
        </div>
      ) : null}

      <TurnList
        turns={turns}
        revealedTheirTurns={visibleTheirTurns}
        onRevealTurn={revealTheirTurn}
      />

      {phase !== 'idle' ? (
        <div
          className="conversation-workbench"
          role="region"
          aria-label="Current exchange"
        >
          {phase === 'connecting' ? (
            <div className="conversation-status-row">
              <span className="conversation-pulse-dot" aria-hidden="true" />
              <span className="conversation-status-copy">
                <strong>Waiting for other station</strong>
                <span>Generating their reply</span>
              </span>
            </div>
          ) : null}

          {phase === 'their-turn-playing' ||
          phase === 'their-turn-paused' ? (
        <>
          <div className="conversation-status-row">
            <span
              className={`conversation-pulse-dot${
                phase === 'their-turn-paused'
                  ? ' conversation-pulse-dot-paused'
                  : ''
              }`}
              aria-hidden="true"
            />
            <span className="conversation-status-copy">
              <strong>
                {phase === 'their-turn-paused'
                  ? 'Morse audio paused'
                  : playbackStalled
                    ? 'Audio did not start'
                    : 'Morse audio playing'}
              </strong>
              <span>
                {phase === 'their-turn-paused'
                  ? 'Playback is stopped'
                  : playbackStalled
                    ? 'Click Play audio to retry'
                    : 'Listen now'}
              </span>
            </span>
          </div>
          <div
            ref={progressBarOuterRef}
            className="conversation-playback-progress"
            role="progressbar"
            aria-label="Other station playback"
            aria-valuemin={0}
            aria-valuemax={Math.round(playDurationMs)}
            aria-valuenow={0}
          >
            <span ref={progressBarRef} />
          </div>
          <div className="conversation-playback-time">
            <span ref={elapsedTextRef}>0:00</span>
            <span>{formatPlaybackTime(playDurationMs)}</span>
          </div>
          <label className="conversation-live-toggle">
            <input
              type="checkbox"
              checked={showLiveLetters}
              onChange={(event) => setShowLiveLetters(event.target.checked)}
            />
            <span>Show letters as received</span>
          </label>
          {showLiveLetters ? (
            <div
              ref={liveLettersRef}
              className="conversation-live-letters"
              aria-label="Letters received"
              aria-live="polite"
            />
          ) : null}
          <label
            className="custom-listen-typealong-label"
            htmlFor="conversation-typed-copy"
          >
            Copy what you hear
          </label>
          <textarea
            ref={typedCopyRef}
            id="conversation-typed-copy"
            className="custom-listen-typealong"
            value={typedCopy}
            onChange={(event) => onTypedCopyChange(event.target.value)}
            disabled={phase === 'their-turn-paused'}
            placeholder="Type as you hear it."
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="conversation-actions">
            {playbackStalled ? (
              <button
                type="button"
                className="hint-button submit-button"
                onClick={handleEnableSound}
              >
                Play audio
              </button>
            ) : phase === 'their-turn-playing' ? (
              <button type="button" className="hint-button" onClick={onPause}>
                Pause
              </button>
            ) : (
              <button type="button" className="hint-button submit-button" onClick={onResume}>
                Resume
              </button>
            )}
            <button type="button" className="hint-button" onClick={onReplay}>
              Replay
            </button>
            <button type="button" className="hint-button" onClick={onEnd}>
              End QSO
            </button>
          </div>
        </>
          ) : null}

          {phase === 'your-turn' || phase === 'sending' ? (
        <>
          {phase === 'your-turn' ? (
            <div className="conversation-status-row conversation-status-row-ready">
              <span className="conversation-ready-dot" aria-hidden="true" />
              <span className="conversation-status-copy">
                <strong>Your turn</strong>
              </span>
            </div>
          ) : null}
          <div
            className="conversation-draft"
            aria-label="Current Morse draft"
            aria-live="polite"
          >
            {draft || '\u00a0'}
          </div>
          <MorseButton
            buttonRef={buttonRef}
            isPressing={isKeying}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
            onKeyDown={(event) => {
              if (event.repeat) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handlePointerDown()
              }
            }}
            onKeyUp={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handlePointerEnd()
              }
            }}
            onBlur={handlePointerEnd}
            showShortcutHint={showShortcutHints}
          />
          <div className="conversation-actions">
            <button
              type="button"
              className="hint-button"
              onClick={onDraftBackspace}
              disabled={draft.length === 0 || phase === 'sending'}
            >
              Backspace
            </button>
            <button
              type="button"
              className="hint-button"
              onClick={onDraftClear}
              disabled={draft.length === 0 || phase === 'sending'}
            >
              Clear
            </button>
            <button
              type="button"
              className="hint-button submit-button"
              onClick={() => {
                if (lastTheirTurn) revealTheirTurn(lastTheirTurn)
                onSendReply()
              }}
              disabled={draft.trim().length === 0 || phase === 'sending'}
            >
              {phase === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>
          {phase === 'your-turn' && lastTheirTurn && !copyWasChecked ? (
            copyExpanded ? (
              <div className="conversation-optional-copy">
                <div className="conversation-optional-copy-heading">
                  <label htmlFor="conversation-typed-copy">Copy reception</label>
                  <span>Optional</span>
                </div>
                <textarea
                  ref={typedCopyRef}
                  id="conversation-typed-copy"
                  className="custom-listen-typealong"
                  value={typedCopy}
                  onChange={(event) => onTypedCopyChange(event.target.value)}
                  placeholder="Type from memory or your notes."
                  aria-label="Copy what you hear"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="conversation-actions">
                  <button
                    type="button"
                    className="hint-button"
                    onClick={() => {
                      revealTheirTurn(lastTheirTurn)
                      onCheckCopy()
                    }}
                  >
                    Check copy
                  </button>
                  <button
                    type="button"
                    className="hint-button"
                    onClick={() => {
                      setExpandedCopyTurnCount(null)
                      setCollapsedCopyTurnCount(turns.length)
                      onSkipCopy()
                    }}
                  >
                    Hide
                  </button>
                  <button type="button" className="hint-button" onClick={onReplay}>
                    Replay
                  </button>
                </div>
              </div>
            ) : (
              <div className="conversation-copy-disclosure">
                <button
                  type="button"
                  className="conversation-copy-disclosure-button"
                  aria-label="Copy reception"
                  aria-controls="conversation-typed-copy"
                  aria-expanded="false"
                  onClick={() => {
                    setCollapsedCopyTurnCount(null)
                    setExpandedCopyTurnCount(turns.length)
                  }}
                >
                  <span>Copy reception</span>
                  <small>Optional</small>
                </button>
                <button type="button" className="hint-button" onClick={onReplay}>
                  Replay
                </button>
              </div>
            )
          ) : null}
          {copyWasChecked && copyDiff ? (
            <div className="custom-listen-reveal conversation-copy-result">
              <div className="custom-listen-diff-row">
                <span className="custom-listen-diff-label">Your copy</span>
                <div className="custom-listen-diff-text">
                  {renderCopyTokens(copyDiff.tokens)}
                </div>
              </div>
              <div className="custom-listen-diff-summary">
                <span className="custom-listen-pill">
                  <span className="custom-listen-pill-num">
                    {copyDiff.matched}
                  </span>
                  /{copyDiff.total} matched
                </span>
                <span className="custom-listen-pill">
                  <span className="custom-listen-pill-num">
                    {copyDiff.missed}
                  </span>{' '}
                  missed
                </span>
                <span className="custom-listen-pill">
                  <span className="custom-listen-pill-num">
                    {copyDiff.extra}
                  </span>{' '}
                  extra
                </span>
              </div>
            </div>
          ) : null}
          <div className="conversation-secondary">
            <button type="button" onClick={onEnd}>
              End QSO
            </button>
          </div>
        </>
          ) : null}

          {phase === 'error' ? (
        <div className="conversation-error">
          <p>{errorMessage ?? 'Something went wrong.'}</p>
          <div className="conversation-actions">
            <button type="button" className="hint-button submit-button" onClick={onRetry}>
              Retry
            </button>
            <button type="button" className="hint-button" onClick={onEnd}>
              End QSO
            </button>
          </div>
        </div>
          ) : null}

          {phase === 'ended' ? (
        <div className="conversation-actions">
          <button type="button" className="hint-button submit-button" onClick={onNewQso}>
            New QSO
          </button>
        </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
