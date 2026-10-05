// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { type UseConversationSessionResult } from '@dit/core'
import { describe, expect, it, vi } from 'vitest'
import { ConversationSurface } from '../../src/components/ConversationSurface'

vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
  DitButton: ({ text, onPress, disabled }: { text: string; onPress: () => void; disabled?: boolean }) => <button onClick={onPress} disabled={disabled}>{text}</button>,
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
    fireEvent.click(screen.getByText('Start my turn'))
    expect(session.beginReply).toHaveBeenCalledOnce()
    unmount()
  })

  it('lets the operator key with empty copy and keep prosign meanings open', () => {
    const session = { ...baseSession(), phase: 'your-turn' as const, turns: [{ speaker: 'them' as const, text: 'CQ TEST K' }] }
    const { unmount } = render(<ConversationSurface session={session} />)
    expect(screen.queryByText('CQ TEST K')).toBeNull()
    expect(screen.queryByLabelText('Your copy')).toBeNull()
    fireEvent.click(screen.getByText('Prosigns'))
    expect(screen.getByText('End of contact')).toBeTruthy()
    fireEvent.click(screen.getByText('Morse key'))
    expect(session.handleKeyPressIn).toHaveBeenCalledOnce()
    expect(screen.getByText('Copy (optional)')).toBeTruthy()
    unmount()
  })

  it('compares copy only on request and exposes expected trailing misses', () => {
    const session = { ...baseSession(), phase: 'your-turn' as const, typedCopy: 'CQ', turns: [{ speaker: 'them' as const, text: 'CQ TEST K' }] }
    const { rerender, unmount } = render(<ConversationSurface session={session} />)
    expect(screen.queryByLabelText('Copy comparison')).toBeNull()
    fireEvent.click(screen.getByText('Check copy'))
    expect(session.checkCopy).toHaveBeenCalledOnce()
    rerender(<ConversationSurface session={{ ...session, copyWasChecked: true }} />)
    expect(screen.getByLabelText('Copy comparison').textContent).toBe('CQ TEST K')
    expect(screen.getByText('2 / 9 matched · 7 missed · 0 extra')).toBeTruthy()
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
