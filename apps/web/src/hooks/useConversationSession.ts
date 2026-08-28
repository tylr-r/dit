import {
  clearTimer,
  decodeMorseCode,
  DOT_THRESHOLD_MS,
  getListenPlaybackDurationMs,
  getListenTiming,
  INTER_CHAR_GAP_MS,
  LISTEN_MIN_UNIT_MS,
  now,
  textToMorseCode,
  useMorsePaddleInput,
  WORD_GAP_EXTRA_MS,
  type TimeoutHandle,
} from '@dit/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSession } from 'firebase/ai'
import {
  ConversationAiError,
  sendTurn,
  startConversation,
} from '../lib/conversationAi'
import { generatePracticeCallsign } from '../lib/conversationCallsign'

export type ConversationPhase =
  | 'idle'
  | 'connecting'
  | 'their-turn-playing'
  | 'their-turn-paused'
  | 'your-turn'
  | 'sending'
  | 'ended'
  | 'error'

export type ConversationTurn = { speaker: 'them' | 'you'; text: string }
export type ConversationStartDirection = 'send' | 'receive'

type PlayMorseToneOptions = {
  code: string
  characterWpm: number
  effectiveWpm: number
  frequency?: number
}

export type UseConversationSessionOptions = {
  toneFrequency: number
  characterWpm: number
  prepareToneEngine: () => Promise<void>
  playMorseTone: (opts: PlayMorseToneOptions) => Promise<void>
  stopMorseTone: () => Promise<void>
  pauseAudioContext: () => Promise<void>
  resumeAudioContext: () => Promise<void>
  getPlaybackElapsedMs: () => number | null
  startTone: (opts?: { frequency?: number }) => Promise<void>
  stopTone: () => Promise<void>
}

export type UseConversationSessionResult = {
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
  start: (direction?: ConversationStartDirection) => Promise<void>
  sendReply: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  replay: () => Promise<void>
  end: () => void
  reset: () => void
  retry: () => Promise<void>
  checkCopy: () => void
  skipCopy: () => void
  setTypedCopy: (next: string) => void
  handleKeyPressIn: () => void
  handleKeyPressOut: () => void
  handleMorseSymbolPressIn: (symbol: '.' | '-') => void
  handleMorseSymbolPressOut: (symbol: '.' | '-') => void
  handleDraftBackspace: () => void
  handleDraftClear: () => void
}

const KICKOFF_MESSAGE =
  'Begin the QSO now — call CQ or send your opening call as you see fit.'

/** Manages an LLM-driven CW conversation: chat turns, Morse playback of the other station, and keyed input for replies. */
export const useConversationSession = (
  options: UseConversationSessionOptions,
): UseConversationSessionResult => {
  const [phase, setPhase] = useState<ConversationPhase>('idle')
  const [turns, setTurns] = useState<ConversationTurn[]>([])
  const [incomingText, setIncomingText] = useState('')
  const [incomingCode, setIncomingCode] = useState('')
  const [playUnitMs, setPlayUnitMs] = useState(0)
  const [playInterCharacterGapMs, setPlayInterCharacterGapMs] = useState(0)
  const [typedCopy, setTypedCopy] = useState('')
  const [copyWasChecked, setCopyWasChecked] = useState(false)
  const [draft, setDraft] = useState('')
  const [isKeying, setIsKeying] = useState(false)
  const [replyStarted, setReplyStarted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playDurationMs, setPlayDurationMs] = useState(0)

  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const chatRef = useRef<ChatSession | null>(null)
  const lastReplyRef = useRef<string | null>(null)
  const lastOtherCallsignRef = useRef<string | undefined>(undefined)
  const pendingTheirTextRef = useRef('')
  const playDurationRef = useRef(0)

  const draftRef = useRef('')
  const symbolBufferRef = useRef('')
  const pressStartRef = useRef<number | null>(null)
  const symbolTimeoutRef = useRef<TimeoutHandle | null>(null)
  const wordTimeoutRef = useRef<TimeoutHandle | null>(null)

  const clearDraftTimers = () => {
    clearTimer(symbolTimeoutRef)
    clearTimer(wordTimeoutRef)
  }

  const scheduleWordSpace = useCallback(() => {
    clearTimer(wordTimeoutRef)
    wordTimeoutRef.current = setTimeout(() => {
      if (symbolBufferRef.current) return
      if (!draftRef.current || draftRef.current.endsWith(' ')) return
      draftRef.current = `${draftRef.current} `
      setDraft(draftRef.current)
    }, WORD_GAP_EXTRA_MS)
  }, [])

  const scheduleLetterCommit = useCallback(() => {
    clearTimer(symbolTimeoutRef)
    symbolTimeoutRef.current = setTimeout(() => {
      const code = symbolBufferRef.current
      symbolBufferRef.current = ''
      if (code) {
        const letter = decodeMorseCode(code)
        if (letter) {
          draftRef.current += letter
          setDraft(draftRef.current)
        }
      }
      scheduleWordSpace()
    }, INTER_CHAR_GAP_MS)
  }, [scheduleWordSpace])

  const registerSymbol = useCallback(
    (symbol: '.' | '-') => {
      symbolBufferRef.current += symbol
      scheduleLetterCommit()
    },
    [scheduleLetterCommit],
  )

  const handleKeyPressIn = useCallback(() => {
    if (phaseRef.current !== 'your-turn' || pressStartRef.current !== null) {
      return
    }
    pressStartRef.current = now()
    clearTimer(symbolTimeoutRef)
    setReplyStarted(true)
    setIsKeying(true)
    void optionsRef.current.startTone({ frequency: optionsRef.current.toneFrequency })
  }, [])

  const handleKeyPressOut = useCallback(() => {
    const start = pressStartRef.current
    pressStartRef.current = null
    setIsKeying(false)
    void optionsRef.current.stopTone()
    if (start === null) return
    const symbol = now() - start < DOT_THRESHOLD_MS ? '.' : '-'
    registerSymbol(symbol)
  }, [registerSymbol])

  const handleKeyingActiveChange = useCallback((active: boolean) => {
    if (active) setReplyStarted(true)
    setIsKeying(active)
  }, [])

  const paddleInput = useMorsePaddleInput({
    canStart: () =>
      phaseRef.current === 'your-turn' && pressStartRef.current === null,
    getUnitMs: () => {
      const { characterWpm } = optionsRef.current
      return getListenTiming(
        characterWpm,
        characterWpm,
        LISTEN_MIN_UNIT_MS,
      ).unitMs
    },
    startTone: () => {
      clearTimer(symbolTimeoutRef)
      void optionsRef.current.startTone({
        frequency: optionsRef.current.toneFrequency,
      })
    },
    stopTone: () => {
      void optionsRef.current.stopTone()
    },
    onSymbol: registerSymbol,
    onActiveChange: handleKeyingActiveChange,
  })

  const handleDraftBackspace = useCallback(() => {
    if (draftRef.current.length === 0) return
    draftRef.current = draftRef.current.slice(0, -1)
    setDraft(draftRef.current)
  }, [])

  const handleDraftClear = useCallback(() => {
    clearDraftTimers()
    symbolBufferRef.current = ''
    draftRef.current = ''
    setDraft('')
  }, [])

  // Audio completion hands control back immediately. Copy remains available
  // as an optional parallel activity rather than gating the Morse key.
  useEffect(() => {
    if (phase !== 'their-turn-playing') return
    let frame = 0
    const tick = () => {
      const elapsed = optionsRef.current.getPlaybackElapsedMs() ?? 0
      if (playDurationRef.current > 0 && elapsed >= playDurationRef.current) {
        const text = pendingTheirTextRef.current
        pendingTheirTextRef.current = ''
        if (text) {
          setTurns((prev) => [...prev, { speaker: 'them', text }])
        }
        setPhase('your-turn')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  const playTheirTurn = useCallback(async (text: string) => {
    const { characterWpm: wpm, toneFrequency: freq } = optionsRef.current
    const { code, normalized } = textToMorseCode(text)
    const timing = getListenTiming(wpm, wpm, LISTEN_MIN_UNIT_MS)
    const duration = getListenPlaybackDurationMs(code, timing.unitMs, timing.interCharacterGapMs)
    pendingTheirTextRef.current = normalized
    playDurationRef.current = duration
    setIncomingText(normalized)
    setIncomingCode(code)
    setPlayUnitMs(timing.unitMs)
    setPlayInterCharacterGapMs(timing.interCharacterGapMs)
    setPlayDurationMs(duration)
    setTypedCopy('')
    setCopyWasChecked(false)
    setReplyStarted(false)
    setPhase('their-turn-playing')
    await optionsRef.current.playMorseTone({ code, characterWpm: wpm, effectiveWpm: wpm, frequency: freq })
  }, [])

  const start = useCallback(
    async (direction: ConversationStartDirection = 'receive') => {
      // Start or resume Web Audio while this function is still running inside
      // the Start QSO click. The AI request resolves later, after Chrome's
      // transient user-activation window has ended.
      void optionsRef.current.prepareToneEngine()
      clearDraftTimers()
      symbolBufferRef.current = ''
      draftRef.current = ''
      setDraft('')
      setTypedCopy('')
      setReplyStarted(false)
      setTurns([])
      setErrorMessage(null)
      lastReplyRef.current = null
      setPhase(direction === 'send' ? 'your-turn' : 'connecting')
      try {
        const callsign = generatePracticeCallsign({
          previousCallsign: lastOtherCallsignRef.current,
        })
        lastOtherCallsignRef.current = callsign
        const chat = startConversation({ callsign })
        chatRef.current = chat
        if (direction === 'send') {
          return
        }
        const opener = await sendTurn(chat, KICKOFF_MESSAGE)
        pendingTheirTextRef.current = opener
        await playTheirTurn(opener)
      } catch (error) {
        setErrorMessage(
          error instanceof ConversationAiError ? error.message : 'Could not start the QSO.',
        )
        setPhase('error')
      }
    },
    [playTheirTurn],
  )

  const sendReply = useCallback(async () => {
    const text = draftRef.current.trim()
    if (!text || phaseRef.current !== 'your-turn' || !chatRef.current) {
      return
    }
    handleDraftClear()
    setTurns((prev) => [...prev, { speaker: 'you', text }])
    lastReplyRef.current = text
    setPhase('sending')
    try {
      const responseText = await sendTurn(chatRef.current, text)
      pendingTheirTextRef.current = responseText
      await playTheirTurn(responseText)
    } catch (error) {
      setErrorMessage(
        error instanceof ConversationAiError ? error.message : 'Could not reach the other station.',
      )
      setPhase('error')
    }
  }, [handleDraftClear, playTheirTurn])

  const retry = useCallback(async () => {
    setErrorMessage(null)
    if (!chatRef.current) {
      await start()
      return
    }
    setPhase('sending')
    try {
      const message = lastReplyRef.current ?? KICKOFF_MESSAGE
      const responseText = await sendTurn(chatRef.current, message)
      pendingTheirTextRef.current = responseText
      await playTheirTurn(responseText)
    } catch (error) {
      setErrorMessage(
        error instanceof ConversationAiError ? error.message : 'Could not reach the other station.',
      )
      setPhase('error')
    }
  }, [start, playTheirTurn])

  const checkCopy = useCallback(() => {
    if (phaseRef.current !== 'your-turn') return
    setCopyWasChecked(true)
  }, [])

  const skipCopy = useCallback(() => {
    if (phaseRef.current !== 'your-turn') return
    setCopyWasChecked(false)
  }, [])

  const pause = useCallback(async () => {
    if (phaseRef.current !== 'their-turn-playing') return
    await optionsRef.current.pauseAudioContext()
    setPhase('their-turn-paused')
  }, [])

  const resume = useCallback(async () => {
    if (phaseRef.current !== 'their-turn-paused') return
    setPhase('their-turn-playing')
    await optionsRef.current.resumeAudioContext()
  }, [])

  const replay = useCallback(async () => {
    const text = pendingTheirTextRef.current || turns[turns.length - 1]?.text
    if (!text) return
    // Replay is a direct user action, so resume the shared AudioContext while
    // Chrome's transient user activation is still available.
    void optionsRef.current.prepareToneEngine()
    pendingTheirTextRef.current = text
    await playTheirTurn(text)
  }, [playTheirTurn, turns])

  const end = useCallback(() => {
    clearDraftTimers()
    pressStartRef.current = null
    paddleInput.cancel()
    setIsKeying(false)
    void optionsRef.current.stopTone()
    void optionsRef.current.stopMorseTone()
    void optionsRef.current.resumeAudioContext()
    setPhase('ended')
  }, [paddleInput])

  const reset = useCallback(() => {
    clearDraftTimers()
    chatRef.current = null
    lastReplyRef.current = null
    pendingTheirTextRef.current = ''
    paddleInput.cancel()
    symbolBufferRef.current = ''
    draftRef.current = ''
    setDraft('')
    setIncomingText('')
    setIncomingCode('')
    setTypedCopy('')
    setCopyWasChecked(false)
    setReplyStarted(false)
    setTurns([])
    setErrorMessage(null)
    setPhase('idle')
  }, [paddleInput])

  // Clean up in-flight timers/tone if the surface unmounts mid-session.
  useEffect(
    () => () => {
      clearDraftTimers()
      void optionsRef.current.stopTone()
      void optionsRef.current.stopMorseTone()
    },
    [],
  )

  return {
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
    start,
    sendReply,
    pause,
    resume,
    replay,
    end,
    reset,
    retry,
    checkCopy,
    skipCopy,
    setTypedCopy,
    handleKeyPressIn,
    handleKeyPressOut,
    handleMorseSymbolPressIn: paddleInput.pressIn,
    handleMorseSymbolPressOut: paddleInput.pressOut,
    handleDraftBackspace,
    handleDraftClear,
  }
}
