import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../../../src/components/HomePage'

const mockStartTone = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockStopTone = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('../../../src/utils/tone', () => ({
  startTone: mockStartTone,
  stopTone: mockStopTone,
}))

vi.mock('../../../src/components/MorseLiquidSurface', () => ({
  MorseLiquidSurface: () => null,
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('links the web app as primary and the App Store as secondary', () => {
    render(<HomePage />)

    const primaryLinks = screen.getAllByRole('link', {
      name: 'Start practicing',
    })
    expect(primaryLinks.length).toBeGreaterThan(0)
    primaryLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/app')
    })

    const storeLinks = [
      ...screen.getAllByRole('link', { name: 'Get the iPhone app' }),
      screen.getByRole('link', { name: 'Download Dit on the App Store' }),
    ]
    storeLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        'href',
        'https://apps.apple.com/us/app/dit-practice-morse-code/id6758277876',
      )
    })
  })

  it('keys the live demo: tone on press, tap and hold decode to a letter', () => {
    // beginPress/endPress sample performance.now once each: a 50ms tap (dit)
    // then a 300ms hold (dah), spelling A (.-).
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(50)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1300)

    render(<HomePage />)
    const key = screen.getByRole('button', { name: 'Tap for dot, hold for dah' })

    fireEvent.pointerDown(key)
    expect(mockStartTone).toHaveBeenCalledTimes(1)
    fireEvent.pointerUp(key)
    expect(mockStopTone).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(key)
    fireEvent.pointerUp(key)

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
