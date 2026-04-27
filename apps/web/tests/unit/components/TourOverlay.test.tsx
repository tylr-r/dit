import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TourOverlay } from '../../../src/components/TourOverlay'

describe('TourOverlay', () => {
  it('renders the first stop title', () => {
    render(<TourOverlay onFinish={vi.fn()} />)
    expect(screen.getByText(/^Modes$/)).toBeInTheDocument()
    expect(screen.getByText(/Switch between Practice/i)).toBeInTheDocument()
  })

  it('advances through stops on click and finishes after the last', () => {
    const onFinish = vi.fn()
    render(<TourOverlay onFinish={onFinish} />)
    const overlay = screen.getByRole('dialog')

    // Stop 1: Modes (initial)
    expect(screen.getByText(/^Modes$/)).toBeInTheDocument()

    // Click -> Stop 2: Settings
    fireEvent.click(overlay)
    expect(screen.getByText(/^Settings$/)).toBeInTheDocument()

    // Click -> Stop 3: Progress
    fireEvent.click(overlay)
    expect(screen.getByText(/Progress \+ chart/i)).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()

    // Click -> finish
    fireEvent.click(overlay)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('shows step dots reflecting current index', () => {
    render(<TourOverlay onFinish={vi.fn()} />)
    const dots = document.body.querySelectorAll('.tour-dot')
    expect(dots).toHaveLength(3)
    expect(dots[0].className).toContain('is-active')
    expect(dots[1].className).not.toContain('is-active')
  })
})
