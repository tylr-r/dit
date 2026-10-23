// @vitest-environment jsdom
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MORSE_DATA, type Letter } from '@dit/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ListenLearningSurface } from '../../src/components/ListenLearningSurface'
import { playMorseTone } from '../../src/utils/tone'

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@dit/core', async (original) => ({ ...await original<typeof import('@dit/core')>(), usePlatform: () => ({ storage }) }))
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }) }))
vi.mock('@expo/ui/swift-ui/modifiers', () => ({
  tag: (value: string) => ({ tag: value }),
  disabled: (value: boolean) => ({ disabled: value }),
  pickerStyle: () => ({}), accessibilityLabel: () => ({}), labelsHidden: () => ({}), frame: () => ({}),
}))
vi.mock('@expo/ui/swift-ui', () => ({
  Host: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: () => null,
  Picker: ({ label, selection, onSelectionChange, children }: {
    label: string; selection: string | null; onSelectionChange: (value: string) => void; children: React.ReactNode
  }) => <select aria-label={label} value={selection ?? ''} onChange={(event) => onSelectionChange(event.target.value)}>
    {selection === null && <option value="" hidden />}
    {React.Children.map(children, (child) => {
      if (!React.isValidElement<{ children: React.ReactNode; modifiers: { tag?: string; disabled?: boolean }[] }>(child)) return null
      const value = child.props.modifiers.find((modifier) => modifier.tag)?.tag
      return <option value={value} disabled={child.props.modifiers.some((modifier) => modifier.disabled)}>{child.props.children}</option>
    })}
  </select>,
}))
vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Pressable: ({ children, style, onPress, disabled, accessibilityLabel }: {
    children: React.ReactNode; style: unknown; onPress: () => void; disabled?: boolean; accessibilityLabel?: string
  }) => <button style={Object.assign({}, ...[style].flat(Infinity).filter(Boolean))}
    onClick={onPress} disabled={disabled} aria-label={accessibilityLabel}>{children}</button>,
  StyleSheet: {
    create: (styles: unknown) => styles,
    flatten: (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)),
  },
  AppState: { addEventListener: () => ({ remove() {} }) },
}))
vi.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }))
vi.mock('expo-symbols', () => ({ SymbolView: () => null }))
vi.mock('../../src/components/GlassSurface', () => ({
  GlassView: ({ children, style }: { children: React.ReactNode; style: unknown }) =>
    <div style={Object.assign({}, ...[style].flat(Infinity).filter(Boolean))}>{children}</div>,
}))
vi.mock('../../src/components/ListenSineWave', () => ({ ListenSineWave: () => <div /> }))
vi.mock('../../src/components/CustomListenSurface', () => ({ CustomListenSurface: () => <div>Custom listening</div> }))
vi.mock('../../src/hooks/useCustomListenSession', () => ({
  useCustomListenSession: () => ({ ready: true, stop: stopCustom }),
}))
const stopCustom = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../../src/utils/tone', () => ({ playMorseTone: vi.fn().mockResolvedValue(undefined), stopMorseTone: vi.fn().mockResolvedValue(undefined) }))

const props = () => ({
  availableLetters: Object.keys(MORSE_DATA) as Letter[], guidedCourseActive: false,
  characterWpm: 20, effectiveWpm: 12, toneFrequency: 640, blocked: false,
  wordCounts: { attempted: 0, correct: 0 }, onWordAnswer: vi.fn(),
  suspendCharacters: vi.fn(), replayCharacter: vi.fn(),
  characterStage: <div>Character stage</div>, characterControls: <div>Character keyboard</div>,
})

beforeEach(() => storage.getItem.mockImplementation(async (key: string) => key === 'dit-listen-content-v1' ? 'words' : 'common'))

const flush = async () => { await act(async () => {}) }

describe('iOS Listen learning surfaces', () => {
  it('restores Words silently without replaying a hidden character', async () => {
    const options = props()
    const { unmount } = render(<ListenLearningSurface {...options} />)
    await flush()
    expect(screen.getByText('Ready when you are')).toBeTruthy()
    expect(options.replayCharacter).not.toHaveBeenCalled()
    expect(playMorseTone).not.toHaveBeenCalled()
    expect(screen.queryByText('Character keyboard')).toBeNull()
    unmount()
  })

  it('conceals every answer until audio completes and conceals them again on replay', async () => {
    let complete = () => {}
    vi.mocked(playMorseTone).mockImplementation(async (options) => { complete = options.onComplete! })
    const { unmount } = render(<ListenLearningSurface {...props()} />)
    await flush()
    fireEvent.click(screen.getByText('Start listening'))
    await flush()
    expect(screen.queryAllByLabelText(/^Answer /).every((button) => button.getAttribute('aria-label') === 'Answer concealed during playback')).toBe(true)
    expect(screen.getAllByLabelText('Answer concealed during playback')).toHaveLength(4)
    act(() => complete())
    const answers = screen.getAllByLabelText(/^Answer /)
    expect(answers).toHaveLength(4)
    expect(answers.every((button) => !button.hasAttribute('disabled'))).toBe(true)
    for (const answer of answers) {
      expect(answer.parentElement?.style.width).toBe('47%')
      expect(answer.parentElement?.style.minHeight).toBe('56px')
      expect(answer.style.width).toBe('100%')
      expect(answer.style.alignSelf).toBe('stretch')
    }
    fireEvent.click(screen.getByText('Replay'))
    await flush()
    expect(screen.getAllByLabelText('Answer concealed during playback')).toHaveLength(4)
    unmount()
  })

  it('forces Characters for the guided course, even when a word preference was saved', async () => {
    const options = { ...props(), guidedCourseActive: true }
    const { unmount } = render(<ListenLearningSurface {...options} />)
    await flush()
    expect(screen.getByText('Character keyboard')).toBeTruthy()
    expect(screen.queryByText('Words')).toBeNull()
    expect(screen.queryByText('Use custom')).toBeNull()
    expect(playMorseTone).not.toHaveBeenCalled()
    expect(options.replayCharacter).toHaveBeenCalledOnce()
    unmount()
  })

  it('switches vocabulary silently and keeps the app-session tally', async () => {
    const { unmount } = render(<ListenLearningSurface {...props()} wordCounts={{ correct: 2, attempted: 3 }} />)
    await flush()
    fireEvent.change(screen.getByRole('combobox', { name: 'Word vocabulary' }), { target: { value: 'q-codes' } })
    await flush()
    expect(playMorseTone).not.toHaveBeenCalled()
    expect(screen.getByText('Ready when you are')).toBeTruthy()
    expect(storage.setItem).toHaveBeenCalledWith('dit-listen-vocabulary-v1', 'q-codes')
    unmount()
  })

  it('switches content through the native picker and restores character playback only on returning', async () => {
    const options = props()
    const { unmount } = render(<ListenLearningSurface {...options} />)
    await flush()
    fireEvent.change(screen.getByRole('combobox', { name: 'Listen content' }), { target: { value: 'characters' } })
    await flush()
    expect(screen.getByText('Character keyboard')).toBeTruthy()
    expect(options.replayCharacter).toHaveBeenCalledOnce()
    expect(storage.setItem).toHaveBeenCalledWith('dit-listen-content-v1', 'characters')
    fireEvent.change(screen.getByRole('combobox', { name: 'Listen content' }), { target: { value: 'words' } })
    await flush()
    expect(screen.getByText('Ready when you are')).toBeTruthy()
    expect(options.replayCharacter).toHaveBeenCalledOnce()
    expect(playMorseTone).not.toHaveBeenCalled()
    unmount()
  })

  it('keeps Words unavailable when the active characters cannot supply four choices', async () => {
    const options = { ...props(), availableLetters: ['E', 'T'] as Letter[] }
    const { unmount } = render(<ListenLearningSurface {...options} />)
    await flush()
    expect(screen.getByText('Character keyboard')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Words' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByRole('combobox', { name: 'Listen content' }), { target: { value: 'words' } })
    await flush()
    expect(screen.getByText('Character keyboard')).toBeTruthy()
    expect(screen.queryByText('Ready when you are')).toBeNull()
    unmount()
  })
})
