// @vitest-environment jsdom
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { type UseConversationSessionResult } from '@dit/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationSurface } from '../../src/components/ConversationSurface'

const scrolling = vi.hoisted(() => ({
  toEnd: vi.fn(), to: vi.fn(),
  resize: undefined as (() => void) | undefined,
  scroll: undefined as ((event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => void) | undefined,
}))
beforeEach(() => { scrolling.toEnd.mockClear(); scrolling.to.mockClear() })

vi.mock('react-native', () => ({
  View: ({ children, testID }: { children: React.ReactNode; testID?: string }) => <div data-testid={testID}>{children}</div>,
  ScrollView: ({ children, ref, accessibilityLabel, onContentSizeChange, onScroll }: {
    children: React.ReactNode; ref?: React.Ref<unknown>; accessibilityLabel?: string;
    onContentSizeChange?: () => void; onScroll?: typeof scrolling.scroll;
  }) => {
    React.useImperativeHandle(ref, () => ({ scrollToEnd: scrolling.toEnd, scrollTo: scrolling.to }))
    if (accessibilityLabel === 'Conversation history and copy') {
      scrolling.resize = onContentSizeChange
      scrolling.scroll = onScroll
    }
    return <div data-scrollable="true">{children}</div>
  },
  KeyboardAvoidingView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, accessibilityLabel }: { children: React.ReactNode; accessibilityLabel?: string }) => <span aria-label={accessibilityLabel}>{children}</span>,
  TextInput: ({ value, onChangeText, accessibilityLabel }: { value: string; onChangeText: (text: string) => void; accessibilityLabel: string }) =>
    <textarea aria-label={accessibilityLabel} value={value} onChange={(event) => onChangeText(event.target.value)} />,
  Switch: ({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string }) =>
    <input type="checkbox" aria-label={accessibilityLabel} checked={value} onChange={(event) => onValueChange(event.target.checked)} />,
  Keyboard: { dismiss: vi.fn() }, StyleSheet: { create: (styles: unknown) => styles },
}))
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }))
vi.mock('../../src/components/DitButton', () => ({
  DitButton: ({ text, icon, accessibilityLabel, onPress, disabled }: { text?: string; icon?: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean }) => <button aria-label={accessibilityLabel} data-icon={icon} onClick={onPress} disabled={disabled}>{text}</button>,
}))
vi.mock('../../src/components/MorseButton', () => ({
  MorseButton: ({ onPressIn }: { onPressIn: () => void }) => <button onClick={onPressIn}>Morse key</button>,
}))
vi.mock('../../src/utils/tone', () => ({ getMorsePlaybackState: () => ({ elapsedMs: 0 }) }))
const baseSession = (): UseConversationSessionResult => ({
  phase: 'their-turn-playing', turns: [], incomingText: 'CQ TEST K', incomingCode: '-.-. --.- / - . ... - / -.-',
  playUnitMs: 60, playInterCharacterGapMs: 180, playDurationMs: 6000,
  typedCopy: '', copyWasChecked: false, draft: '', isKeying: false, replyStarted: false, errorMessage: null,
  start: vi.fn(), beginReply: vi.fn(), sendReply: vi.fn(), pause: vi.fn(), resume: vi.fn(), replay: vi.fn(),
  end: vi.fn(), reset: vi.fn(), retry: vi.fn(), checkCopy: vi.fn(), skipCopy: vi.fn(), setTypedCopy: vi.fn(),
  handleKeyPressIn: vi.fn(), handleKeyPressOut: vi.fn(), handleMorseSymbolPressIn: vi.fn(), handleMorseSymbolPressOut: vi.fn(),
  handleDraftBackspace: vi.fn(), handleDraftClear: vi.fn(), cancelInput: vi.fn(), cancelPaddleInput: vi.fn(),
})

describe('native QSO learning surface', () => {
  it('keeps recovery actions together when a first connection fails', () => {
    const session = { ...baseSession(), phase: 'error' as const, errorMessage: 'Could not reach the other station. Try again.' }
    const { unmount } = render(<ConversationSurface session={session} />)
    expect(screen.getByText('Station unavailable')).toBeTruthy()
    expect(screen.queryByText('Prosigns')).toBeNull()
    expect(screen.queryByText('Morse key')).toBeNull()
    fireEvent.click(screen.getByText('Retry'))
    expect(session.retry).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('End QSO'))
    expect(session.end).toHaveBeenCalledOnce()
    unmount()
  })

  it('conceals incoming text and preserves the editable copy field and focus at completion', () => {
    const session = baseSession()
    const { rerender, unmount } = render(<ConversationSurface session={session} />)
    expect(screen.queryByText('CQ TEST K')).toBeNull()
    const copy = screen.getByLabelText('Type what you hear')
    copy.focus()
    rerender(<ConversationSurface session={{ ...session, phase: 'finishing-copy' }} />)
    expect(screen.getByLabelText('Type what you hear')).toBe(copy)
    expect(document.activeElement).toBe(copy)
    expect(screen.queryByText('Morse key')).toBeNull()
    fireEvent.change(copy, { target: { value: 'CQ TEST' } })
    expect(session.setTypedCopy).toHaveBeenCalledWith('CQ TEST')
    fireEvent.click(screen.getByText('Reply'))
    expect(session.beginReply).toHaveBeenCalledOnce()
    unmount()
  })

  it('lets the operator key with empty copy and keep prosign meanings open', () => {
    const session = { ...baseSession(), phase: 'your-turn' as const, turns: [{ speaker: 'them' as const, text: 'CQ TEST K' }] }
    const { unmount } = render(<ConversationSurface session={session} />)
    expect(screen.queryByText('CQ TEST K')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('Check copy')).toBeNull()
    expect(screen.getByText('Reply')).toBeTruthy()
    expect(screen.queryByText('Your turn')).toBeNull()
    expect(screen.queryByText('Key your reply')).toBeNull()
    const reveal = screen.getByRole('button', { name: 'Reveal received message' })
    expect(reveal.getAttribute('data-icon')).toBeNull()
    expect(reveal.textContent).toBe('Reveal')
    expect(screen.queryByText('Reveal received turn')).toBeNull()
    fireEvent.click(screen.getByText('Prosigns'))
    expect(screen.getByText('End of contact')).toBeTruthy()
    fireEvent.click(screen.getByText('Morse key'))
    expect(session.handleKeyPressIn).toHaveBeenCalledOnce()
    expect(screen.queryByText('Copy (optional)')).toBeNull()
    expect(screen.queryByText('Hide copy')).toBeNull()
    expect(session.checkCopy).not.toHaveBeenCalled()
    expect(session.skipCopy).not.toHaveBeenCalled()
    unmount()
  })

  it('keeps the key last in a fixed reply area as references and the draft grow', () => {
    const session = { ...baseSession(), phase: 'your-turn' as const, draft: 'R', turns: [{ speaker: 'them' as const, text: 'CQ TEST K' }] }
    const { rerender, unmount } = render(<ConversationSurface session={session} />)
    const dock = screen.getByTestId('conversation-reply-dock')
    const key = within(dock).getByText('Morse key')
    expect(key.closest('[data-scrollable]')).toBeNull()
    expect(dock.lastElementChild).toBe(key)
    expect(within(dock).getByText('Send')).toBeTruthy()
    expect(dock.contains(screen.getByText('End QSO'))).toBe(false)

    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByText('Prosigns'))
    rerender(<ConversationSurface session={{ ...session, typedCopy: 'CQ', copyWasChecked: true, draft: 'R '.repeat(100) }} />)
    expect(screen.queryByLabelText('Copy comparison')).toBeNull()
    expect(screen.getByText('Morse key')).toBe(key)
    expect(dock.lastElementChild).toBe(key)
    unmount()
  })

  it('compares copy only on request and exposes expected trailing misses', () => {
    const session = { ...baseSession(), phase: 'finishing-copy' as const, typedCopy: 'CQ', turns: [{ speaker: 'them' as const, text: 'OLDER TURN' }] }
    const { rerender, unmount } = render(<ConversationSurface session={session} />)
    expect(screen.queryByLabelText('Copy comparison')).toBeNull()
    fireEvent.click(screen.getByText('Check copy'))
    expect(session.checkCopy).toHaveBeenCalledOnce()
    rerender(<ConversationSurface session={{ ...session, copyWasChecked: true }} />)
    expect(screen.getByLabelText('Copy comparison').textContent).toBe('CQ TEST K')
    expect(screen.queryByText('OLDER TURN')).toBeNull()
    expect(screen.getByText('2 / 9 matched · 7 missed · 0 extra')).toBeTruthy()
    expect(screen.queryByText('Morse key')).toBeNull()
    rerender(<ConversationSurface session={{ ...session, phase: 'your-turn', copyWasChecked: true }} />)
    expect(screen.getByText('Morse key')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('Check copy')).toBeNull()
    expect(screen.queryByLabelText('Copy comparison')).toBeNull()
    unmount()
  })

  it('opens at the latest content but preserves scrolling back through history', () => {
    const session = { ...baseSession(), phase: 'your-turn' as const, turns: Array.from({ length: 20 }, () => ({ speaker: 'them' as const, text: 'CQ TEST K' })) }
    const { rerender, unmount } = render(<ConversationSurface session={session} />)
    expect(scrolling.toEnd).toHaveBeenCalledWith({ animated: false })
    scrolling.toEnd.mockClear()
    act(() => scrolling.resize?.())
    expect(scrolling.toEnd).toHaveBeenCalledOnce()
    scrolling.toEnd.mockClear()
    act(() => scrolling.scroll?.({ nativeEvent: { contentOffset: { y: 0 }, contentSize: { height: 2000 }, layoutMeasurement: { height: 300 } } }))
    act(() => scrolling.resize?.())
    expect(scrolling.toEnd).not.toHaveBeenCalled()
    rerender(<ConversationSurface session={{ ...session, phase: 'finishing-copy' }} />)
    expect(scrolling.toEnd).toHaveBeenCalledOnce()
    unmount()
  })

  it('reveals only the selected received message with the Reveal button', () => {
    const session = { ...baseSession(), phase: 'your-turn' as const, turns: [{ speaker: 'them' as const, text: 'CQ TEST K' }, { speaker: 'you' as const, text: 'R E' }, { speaker: 'them' as const, text: 'UR RST 5NN K' }] }
    const { unmount } = render(<ConversationSurface session={session} />)
    expect(screen.queryByText('CQ TEST K')).toBeNull()
    expect(screen.queryByText('UR RST 5NN K')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Reveal received message' })[0])
    expect(screen.getByText('CQ TEST K')).toBeTruthy()
    expect(screen.queryByText('UR RST 5NN K')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Reveal received message' })).toHaveLength(1)
    unmount()
  })

  it('reveals the whole transcript only when the contact ends', () => {
    const session = { ...baseSession(), phase: 'your-turn' as const, turns: [{ speaker: 'them' as const, text: 'CQ TEST K' }, { speaker: 'you' as const, text: 'R E' }] }
    const { rerender, unmount } = render(<ConversationSurface session={session} />)
    expect(screen.queryByText('CQ TEST K')).toBeNull()
    expect(screen.getByText('R E')).toBeTruthy()
    rerender(<ConversationSurface session={{ ...session, phase: 'ended' }} />)
    expect(screen.getByText('CQ TEST K')).toBeTruthy()
    expect(screen.getByText('New QSO')).toBeTruthy()
    unmount()
  })
})
