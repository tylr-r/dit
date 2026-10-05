import { clearTimer, now, DOT_THRESHOLD_MS, INTER_CHAR_GAP_MS, LISTEN_MIN_UNIT_MS, WORD_GAP_EXTRA_MS, type TimeoutHandle } from '../utils/appState'
import { decodeMorseCode } from '../utils/morseUtils'
import { getListenTiming, getListenPlaybackDurationMs } from '../utils/listenWave'
import { textToMorseCode } from '../utils/customListenText'
import { useMorsePaddleInput } from './useMorsePaddleInput'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationAiError, generatePracticeCallsign, type StartConversationOptions } from '../utils/conversation'

export type ConversationChat = { send: (text: string) => Promise<string> }

export type ConversationPhase =
  | 'idle'
  | 'connecting'
  | 'their-turn-playing'
  | 'their-turn-paused'
  | 'finishing-copy'
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
  createConversation: (options: StartConversationOptions) => ConversationChat | Promise<ConversationChat>
  isPlaybackComplete?: () => boolean
  restoreAudioOnEnd?: boolean
  canInteract?: () => boolean
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
  beginReply: () => void
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
  cancelInput: () => void
  cancelPaddleInput: () => void
}

const KICKOFF_MESSAGE =
  'Begin the QSO now. Call CQ or send your opening call as you see fit.'

/** Manages an LLM-driven CW conversation: chat turns, Morse playback of the other station, and keyed input for replies. */
export const useConversationSession = (
  options: UseConversationSessionOptions,
): UseConversationSessionResult => {
  const [phase, updatePhase] = useState<ConversationPhase>('idle')
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
  const setPhase = (next: ConversationPhase) => {
    phaseRef.current = next
    updatePhase(next)
  }
  const operationRef = useRef(0)

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const chatRef = useRef<ConversationChat | null>(null)
  const lastReplyRef = useRef<string | null>(null)
  const startDirectionRef = useRef<ConversationStartDirection>('receive')
  const lastOtherCallsignRef = useRef<string | undefined>(undefined)
  const pendingTheirTextRef = useRef('')
  const playDurationRef = useRef(0)
  const playbackReadyRef = useRef(false)

  const draftRef = useRef('')
  const hasAutomaticTrailingSpaceRef = useRef(false)
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
      hasAutomaticTrailingSpaceRef.current = true
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
          hasAutomaticTrailingSpaceRef.current = false
          setDraft(draftRef.current)
        }
      }
      scheduleWordSpace()
    }, INTER_CHAR_GAP_MS)
  }, [scheduleWordSpace])

  const registerSymbol = useCallback(
    (symbol: '.' | '-') => {
      if (optionsRef.current.canInteract?.() === false || phaseRef.current !== 'your-turn') return
      symbolBufferRef.current += symbol
      scheduleLetterCommit()
    },
    [scheduleLetterCommit],
  )

  const handleKeyPressIn = useCallback(() => {
    if (optionsRef.current.canInteract?.() === false || phaseRef.current !== 'your-turn' || pressStartRef.current !== null) {
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
    if (start === null || optionsRef.current.canInteract?.() === false || phaseRef.current !== 'your-turn') return
    const symbol = now() - start < DOT_THRESHOLD_MS ? '.' : '-'
    registerSymbol(symbol)
  }, [registerSymbol])

  const handleKeyingActiveChange = useCallback((active: boolean) => {
    if (active) setReplyStarted(true)
    setIsKeying(active)
  }, [])

  const paddleInput = useMorsePaddleInput({
    canStart: () =>
      optionsRef.current.canInteract?.() !== false && phaseRef.current === 'your-turn' && pressStartRef.current === null,
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
    clearTimer(wordTimeoutRef)
    if (draftRef.current.length === 0) return
    // Skip only the fresh word-gap space, not spaces exposed by earlier edits.
    const deleteCount = hasAutomaticTrailingSpaceRef.current ? 2 : 1
    draftRef.current = draftRef.current.slice(0, -deleteCount)
    hasAutomaticTrailingSpaceRef.current = false
    setDraft(draftRef.current)
  }, [])

  const handleDraftClear = useCallback(() => {
    clearDraftTimers()
    symbolBufferRef.current = ''
    draftRef.current = ''
    hasAutomaticTrailingSpaceRef.current = false
    setDraft('')
  }, [])

  // Keep reception in place until the operator explicitly starts their reply.
  useEffect(() => {
    if (phase !== 'their-turn-playing') return
    let frame = 0
    const tick = () => {
      const elapsed = optionsRef.current.getPlaybackElapsedMs() ?? 0
      if (playbackReadyRef.current && (optionsRef.current.isPlaybackComplete?.() ?? (playDurationRef.current > 0 && elapsed >= playDurationRef.current))) {
        setPhase('finishing-copy')
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
    playbackReadyRef.current = false
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
    const operation = operationRef.current
    await optionsRef.current.playMorseTone({ code, characterWpm: wpm, effectiveWpm: wpm, frequency: freq })
    if (operation !== operationRef.current) return
    playbackReadyRef.current = true
    setPhase('their-turn-playing')
  }, [])

  const start = useCallback(
    async (direction: ConversationStartDirection = 'receive') => {
      if (optionsRef.current.canInteract?.() === false) return
      startDirectionRef.current = direction
      const operation = ++operationRef.current
      pendingTheirTextRef.current = ''
      chatRef.current = null
      // Start or resume Web Audio while this function is still running inside
      // the Start QSO click. The AI request resolves later, after Chrome's
      // transient user-activation window has ended.
      void optionsRef.current.prepareToneEngine()
      clearDraftTimers()
      symbolBufferRef.current = ''
      draftRef.current = ''
      hasAutomaticTrailingSpaceRef.current = false
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
        const pendingChat = optionsRef.current.createConversation({ callsign })
        if ('then' in pendingChat) setPhase('connecting')
        const chat = 'then' in pendingChat ? await pendingChat : pendingChat
        if (operation !== operationRef.current) return
        chatRef.current = chat
        if (direction === 'send') {
          setPhase('your-turn')
          return
        }
        const opener = await chat.send(KICKOFF_MESSAGE)
        if (operation !== operationRef.current) return
        pendingTheirTextRef.current = opener
        await playTheirTurn(opener)
      } catch (error) {
        if (operation !== operationRef.current) return
        setErrorMessage(
          error instanceof ConversationAiError ? error.message : 'Could not start the QSO.',
        )
        setPhase('error')
      }
    },
    [playTheirTurn],
  )

  const commitReceivedTurn = useCallback(() => {
    const text = pendingTheirTextRef.current
    pendingTheirTextRef.current = ''
    if (text) setTurns((prev) => [...prev, { speaker: 'them', text }])
  }, [])

  const beginReply = useCallback(() => {
    if (optionsRef.current.canInteract?.() === false || phaseRef.current !== 'finishing-copy') return
    commitReceivedTurn()
    setPhase('your-turn')
  }, [commitReceivedTurn])

  const sendReply = useCallback(async () => {
    const text = draftRef.current.trim()
    if (optionsRef.current.canInteract?.() === false || !text || phaseRef.current !== 'your-turn' || !chatRef.current) {
      return
    }
    const operation = ++operationRef.current
    handleDraftClear()
    setTurns((prev) => [...prev, { speaker: 'you', text }])
    lastReplyRef.current = text
    setPhase('sending')
    try {
      const responseText = await chatRef.current.send(text)
      if (operation !== operationRef.current) return
      pendingTheirTextRef.current = responseText
      await playTheirTurn(responseText)
    } catch (error) {
      if (operation !== operationRef.current) return
      setErrorMessage(
        error instanceof ConversationAiError ? error.message : 'Could not reach the other station.',
      )
      setPhase('error')
    }
  }, [handleDraftClear, playTheirTurn])

  const retry = useCallback(async () => {
    if (optionsRef.current.canInteract?.() === false || phaseRef.current !== 'error') return
    const operation = ++operationRef.current
    setErrorMessage(null)
    if (!chatRef.current) {
      await start(startDirectionRef.current)
      return
    }
    setPhase('sending')
    try {
      const message = lastReplyRef.current ?? KICKOFF_MESSAGE
      const responseText = await chatRef.current.send(message)
      if (operation !== operationRef.current) return
      pendingTheirTextRef.current = responseText
      await playTheirTurn(responseText)
    } catch (error) {
      if (operation !== operationRef.current) return
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

  const playbackError = (error: unknown, operation: number) => {
    if (operation !== operationRef.current) return
    setErrorMessage(error instanceof Error ? error.message : 'Could not play the transmission. Try again.')
    setPhase('error')
  }

  const pause = useCallback(async () => {
    if (phaseRef.current !== 'their-turn-playing') return
    const operation = ++operationRef.current
    setPhase('their-turn-paused')
    try {
      await optionsRef.current.pauseAudioContext()
    } catch (error) { playbackError(error, operation) }
  }, [])

  const resume = useCallback(async () => {
    if (optionsRef.current.canInteract?.() === false || phaseRef.current !== 'their-turn-paused') return
    const operation = ++operationRef.current
    try {
      await optionsRef.current.resumeAudioContext()
      if (operation === operationRef.current) setPhase('their-turn-playing')
    } catch (error) { playbackError(error, operation) }
  }, [])

  const replay = useCallback(async () => {
    if (optionsRef.current.canInteract?.() === false) return
    const text = pendingTheirTextRef.current || [...turns].reverse().find((turn) => turn.speaker === 'them')?.text
    if (!text) return
    const operation = ++operationRef.current
    // Web Audio preparation must remain inside the direct user gesture.
    void optionsRef.current.prepareToneEngine()
    try { await playTheirTurn(text) }
    catch (error) { playbackError(error, operation) }
  }, [playTheirTurn, turns])

  const cancelInput = useCallback(() => {
    clearDraftTimers()
    pressStartRef.current = null
    symbolBufferRef.current = ''
    paddleInput.cancel()
    setIsKeying(false)
    void optionsRef.current.stopTone()
  }, [paddleInput])

  const end = useCallback(() => {
    operationRef.current += 1
    cancelInput()
    commitReceivedTurn()
    void optionsRef.current.stopMorseTone()
    if (optionsRef.current.restoreAudioOnEnd !== false) void optionsRef.current.resumeAudioContext()
    setPhase('ended')
  }, [cancelInput, commitReceivedTurn])

  const reset = useCallback(() => {
    operationRef.current += 1
    cancelInput()
    void optionsRef.current.stopMorseTone()
    clearDraftTimers()
    chatRef.current = null
    lastReplyRef.current = null
    pendingTheirTextRef.current = ''
    symbolBufferRef.current = ''
    draftRef.current = ''
    hasAutomaticTrailingSpaceRef.current = false
    setDraft('')
    setIncomingText('')
    setIncomingCode('')
    setTypedCopy('')
    setCopyWasChecked(false)
    setReplyStarted(false)
    setTurns([])
    setErrorMessage(null)
    setPhase('idle')
  }, [cancelInput])

  // Clean up in-flight timers/tone if the surface unmounts mid-session.
  useEffect(
    () => () => {
      operationRef.current += 1
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
    beginReply,
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
    cancelInput,
    cancelPaddleInput: paddleInput.cancel,
  }
}
