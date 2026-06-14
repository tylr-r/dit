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

  it('sells the method with three story bands, a citation, and a pill strip', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', {
        name: 'Fluent operators never count. Neither will you.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'The same method serious operators have trusted for 90 years.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: "It can tell which letters you're still working out in your head.",
      }),
    ).toBeInTheDocument()

    // The three bands render as labelled region landmarks.
    expect(screen.getAllByRole('region').length).toBeGreaterThanOrEqual(3)

    // The proven method is cited, not just asserted.
    expect(
      screen.getByText('Koch, 1935 · ARRL Farnsworth timing standard'),
    ).toBeInTheDocument()

    // Conveniences collapse into a pill strip.
    expect(screen.getByText('No sign-up to start')).toBeInTheDocument()
    expect(screen.getByText('Works with a paddle')).toBeInTheDocument()

    // The old six-row ledger content is gone.
    expect(
      screen.queryByText(
        'No charts. You build the reflex, not a translation habit.',
      ),
    ).not.toBeInTheDocument()
  })
})
