import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../../../src/components/HomePage'

const mockPlayMorseTone = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockStopMorseTone = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('../../../src/utils/tone', () => ({
  playMorseTone: mockPlayMorseTone,
  stopMorseTone: mockStopMorseTone,
}))

describe('HomePage', () => {
  beforeEach(() => {
    mockPlayMorseTone.mockClear()
    mockStopMorseTone.mockClear()
  })

  it('renders the hero copy and both calls to action', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /learn morse code by/i }),
    ).toBeInTheDocument()
    // The visible label uses a non-breaking space in "App Store".
    const appStoreLink = screen.getByRole('link', { name: /download/i })
    expect(appStoreLink).toHaveAttribute(
      'href',
      expect.stringContaining('apps.apple.com'),
    )
    expect(
      screen.getByRole('link', { name: /try it in your browser/i }),
    ).toHaveAttribute('href', '/')
  })

  it('sets the document title while mounted', () => {
    const { unmount } = render(<HomePage />)
    expect(document.title).toBe('Dit — Learn Morse Code by Ear')
    unmount()
  })

  it('plays the app name in morse at real speed', () => {
    render(<HomePage />)
    fireEvent.click(
      screen.getByRole('button', { name: /play the word "dit" in morse/i }),
    )
    expect(mockPlayMorseTone).toHaveBeenCalledWith(
      expect.objectContaining({
        code: '-.. .. -',
        characterWpm: 18,
        effectiveWpm: 18,
      }),
    )
  })

  it('replays with wider spacing when room to think is selected', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByRole('button', { name: /room to think/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /play the word "dit" in morse/i }),
    )
    expect(mockPlayMorseTone).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveWpm: 8 }),
    )
  })
})
