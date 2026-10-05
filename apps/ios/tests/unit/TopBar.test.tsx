// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TopBar } from '../../src/components/TopBar'

vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Pressable: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  StyleSheet: { create: (styles: unknown) => styles },
}))
vi.mock('../../src/components/DitButton', () => ({ DitButton: () => <button>Settings</button> }))
vi.mock('../../src/components/DitLogo', () => ({ default: () => <span>Dit</span> }))
vi.mock('../../src/components/ModeSwitcher', () => ({ ModeSwitcher: () => <button>Mode</button> }))
afterEach(cleanup)

const actions = { onModeChange: vi.fn(), onPressReference: vi.fn(), onSettingsPress: vi.fn() }

describe('course context in the header', () => {
  it('omits guided-course progress from an unscored Conversation', () => {
    render(<TopBar {...actions} mode="conversation" courseChipText="Pack 1" />)
    expect(screen.queryByText('Pack 1')).toBeNull()
  })

  it('retains the pack badge during scored learning', () => {
    render(<TopBar {...actions} mode="practice" courseChipText="Pack 1" />)
    expect(screen.getByText('Pack 1')).toBeTruthy()
  })
})
