import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ConversationSurface,
  type ConversationSurfaceProps,
} from '../../../src/components/ConversationSurface'

const baseProps: ConversationSurfaceProps = {
  phase: 'idle',
  turns: [],
  incomingText: '',
  incomingCode: '',
  playUnitMs: 60,
  playInterCharacterGapMs: 180,
  typedCopy: '',
  copyWasChecked: false,
  draft: '',
  isKeying: false,
  replyStarted: false,
  errorMessage: null,
  playDurationMs: 60_000,
  getPlaybackElapsedMs: vi.fn(() => 1_000),
  showShortcutHints: false,
  onStart: vi.fn(),
  onSendReply: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onReplay: vi.fn(),
  onEnd: vi.fn(),
  onNewQso: vi.fn(),
  onRetry: vi.fn(),
  onCheckCopy: vi.fn(),
  onSkipCopy: vi.fn(),
  onTypedCopyChange: vi.fn(),
  onKeyPressIn: vi.fn(),
  onKeyPressOut: vi.fn(),
  onDraftBackspace: vi.fn(),
  onDraftClear: vi.fn(),
}

describe('ConversationSurface playback status', () => {
  it('keeps the newest transcript turn in view', () => {
    const firstTurns = [{ speaker: 'them' as const, text: 'CQ CQ' }]
    const { rerender } = render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={firstTurns}
      />,
    )
    const history = screen.getByRole('region', {
      name: 'Conversation history',
    })
    Object.defineProperty(history, 'scrollHeight', {
      configurable: true,
      value: 500,
    })

    rerender(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[
          ...firstTurns,
          { speaker: 'you', text: 'DE KM7DFG' },
        ]}
      />,
    )

    expect(history.scrollTop).toBe(500)
  })

  it('asks whether the operator wants to send or receive first', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<ConversationSurface {...baseProps} onStart={onStart} />)

    expect(screen.getByText('Do you want to send or receive first?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send first' }))
    await user.click(screen.getByRole('button', { name: 'Receive first' }))

    expect(onStart).toHaveBeenNthCalledWith(1, 'send')
    expect(onStart).toHaveBeenNthCalledWith(2, 'receive')
  })

  it('makes active Morse playback explicit', () => {
    render(
      <ConversationSurface
        {...baseProps}
        phase="their-turn-playing"
        turns={[{ speaker: 'them', text: 'CQ CQ DE W8XYZ' }]}
      />,
    )

    expect(screen.getByText('Morse audio playing')).toBeInTheDocument()
    expect(screen.getByText('Listen now')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Conversation history' }),
    ).not.toHaveTextContent('CQ CQ DE W8XYZ')
    expect(
      screen.getByRole('button', { name: 'Reveal message' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Current exchange' }),
    ).toContainElement(screen.getByText('Morse audio playing'))
  })

  it('lets the operator type copy while the other station is sending', () => {
    const onTypedCopyChange = vi.fn()

    render(
      <ConversationSurface
        {...baseProps}
        phase="their-turn-playing"
        typedCopy="CQ"
        onTypedCopyChange={onTypedCopyChange}
      />,
    )

    const copyField = screen.getByRole('textbox', { name: 'Copy what you hear' })
    expect(copyField).toHaveValue('CQ')
    expect(copyField).toHaveFocus()

    fireEvent.change(copyField, { target: { value: 'CQ TEST' } })
    expect(onTypedCopyChange).toHaveBeenCalledWith('CQ TEST')
  })

  it('keeps copy editable after playback until the operator chooses', async () => {
    const user = userEvent.setup()
    const onCheckCopy = vi.fn()
    const onSkipCopy = vi.fn()

    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'CQ TEST K' }]}
        typedCopy="CQ TEST"
        onCheckCopy={onCheckCopy}
        onSkipCopy={onSkipCopy}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Copy what you hear' })).toBeEnabled()
    expect(
      screen.getByRole('region', { name: 'Conversation history' }),
    ).not.toHaveTextContent('CQ TEST K')
    await user.click(screen.getByRole('button', { name: 'Check copy' }))
    expect(onCheckCopy).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('region', { name: 'Conversation history' }),
    ).toHaveTextContent('CQ TEST K')
    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(onSkipCopy).toHaveBeenCalledOnce()
  })

  it('reveals a received message only when the operator asks', async () => {
    const user = userEvent.setup()
    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'KM7DFG DE K7JWA K' }]}
      />,
    )

    const history = screen.getByRole('region', { name: 'Conversation history' })
    expect(history).not.toHaveTextContent('KM7DFG DE K7JWA K')

    await user.click(screen.getByRole('button', { name: 'Reveal message' }))

    expect(history).toHaveTextContent('KM7DFG DE K7JWA K')
  })

  it('reveals the received message when the operator starts responding', () => {
    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'KM7DFG DE K7JWA K' }]}
      />,
    )

    const history = screen.getByRole('region', { name: 'Conversation history' })
    expect(history).not.toHaveTextContent('KM7DFG DE K7JWA K')

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Tap for dot, hold for dah' }),
    )

    expect(history).toHaveTextContent('KM7DFG DE K7JWA K')
  })

  it('reveals the received message when external keying starts', async () => {
    const turn = { speaker: 'them' as const, text: 'KM7DFG DE K7JWA K' }
    const { rerender } = render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[turn]}
      />,
    )

    rerender(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[turn]}
        replyStarted
      />,
    )

    expect(
      await screen.findByText('KM7DFG DE K7JWA K', {
        selector: '.conversation-turn-text',
      }),
    ).toBeInTheDocument()
  })

  it('keeps a live-letter message visible after playback finishes', async () => {
    const { rerender } = render(
      <ConversationSurface
        {...baseProps}
        phase="their-turn-playing"
        turns={[{ speaker: 'them', text: 'ET' }]}
        incomingText="ET"
        incomingCode=". -"
      />,
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Show letters as received' }),
    )
    rerender(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'ET' }]}
        incomingText="ET"
        incomingCode=". -"
      />,
    )

    expect(
      await screen.findByText('ET', { selector: '.conversation-turn-text' }),
    ).toBeInTheDocument()
  })

  it('offers optional copy and the Morse key together after reception', () => {
    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'KM7DFG DE K7JWA K' }]}
      />,
    )

    const key = screen.getByRole('button', { name: 'Tap for dot, hold for dah' })
    const copyToggle = screen.getByRole('button', { name: 'Copy reception' })

    expect(key).toBeEnabled()
    expect(screen.queryByRole('textbox', { name: 'Copy what you hear' })).toBeNull()
    expect(
      key.compareDocumentPosition(copyToggle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.queryByText('Your reply')).toBeNull()
    expect(screen.queryByText('Key now. Copy is optional.')).toBeNull()
  })

  it('expands optional copy on request', async () => {
    const user = userEvent.setup()
    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'KM7DFG DE K7JWA K' }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Copy reception' }))

    expect(screen.getByRole('textbox', { name: 'Copy what you hear' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Check copy' })).toBeEnabled()
  })

  it('keeps optional copy expanded when the operator typed during playback', () => {
    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'KM7DFG DE K7JWA K' }]}
        typedCopy="KM7DFG"
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Copy what you hear' })).toHaveValue(
      'KM7DFG',
    )
  })

  it('opens and closes the optional prosign reference', async () => {
    const user = userEvent.setup()
    render(<ConversationSurface {...baseProps} phase="your-turn" />)

    const tab = screen.getByRole('button', { name: 'Prosigns' })
    expect(tab).toHaveAttribute('aria-controls', 'conversation-prosign-reference')
    await user.click(tab)

    const reference = screen.getByRole('dialog', { name: 'Prosign reference' })
    expect(reference).toHaveAttribute('id', 'conversation-prosign-reference')
    expect(reference).toHaveTextContent('KN')
    expect(reference).toHaveTextContent('Named station only')
    expect(reference.querySelector('code')).toBeNull()
    expect(reference).not.toHaveTextContent('-.--.')

    await user.click(tab)
    expect(screen.queryByRole('dialog', { name: 'Prosign reference' })).not.toBeInTheDocument()
  })

  it('optionally reveals completed letters in sync with playback', () => {
    let elapsedMs = 100
    let animationFrame: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrame = callback
      return 1
    })

    render(
      <ConversationSurface
        {...baseProps}
        phase="their-turn-playing"
        incomingText="ET"
        incomingCode=". -"
        playUnitMs={100}
        playInterCharacterGapMs={300}
        getPlaybackElapsedMs={() => elapsedMs}
      />,
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Show letters as received' }),
    )
    act(() => animationFrame?.(0))
    expect(screen.getByLabelText('Letters received')).toHaveTextContent('E')

    elapsedMs = 700
    act(() => animationFrame?.(700))
    expect(screen.getByLabelText('Letters received')).toHaveTextContent('ET')

    vi.unstubAllGlobals()
  })

  it('judges the typed copy when playback hands off to the operator', () => {
    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'CQ TEST' }]}
        typedCopy="CQ BEST"
        copyWasChecked
        onTypedCopyChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Your copy')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('/7 matched')).toBeInTheDocument()
    expect(screen.getByText('missed').closest('.custom-listen-pill')).toHaveTextContent(
      '1 missed',
    )
    expect(screen.getByText('extra').closest('.custom-listen-pill')).toHaveTextContent(
      '1 extra',
    )
  })

  it('shows trailing expected characters that were not copied', () => {
    render(
      <ConversationSurface
        {...baseProps}
        phase="your-turn"
        turns={[{ speaker: 'them', text: 'CQ K' }]}
        typedCopy="CQ"
        copyWasChecked
      />,
    )

    expect(
      screen.getByText('K', { selector: '.custom-diff-miss' }),
    ).toBeInTheDocument()
  })

  it('shows a recovery action when the audio clock does not start', async () => {
    let frameTime = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameTime += 800
      window.setTimeout(() => callback(frameTime), 0)
      return frameTime
    })

    render(
      <ConversationSurface
        {...baseProps}
        phase="their-turn-playing"
        getPlaybackElapsedMs={() => 0}
      />,
    )

    expect(
      await screen.findByText('Audio did not start'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Play audio' }),
    ).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
