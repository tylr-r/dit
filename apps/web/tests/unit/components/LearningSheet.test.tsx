import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LearningSheet } from '../../../src/components/LearningSheet'
import type { LearningSheetProps } from '../../../src/components/componentProps'

const baseProps: LearningSheetProps = {
  guidedCourseActive: false,
  guidedPackIndex: 0,
  guidedMaxPackReached: 0,
  maxLevel: 3,
  customLetters: [],
  onClose: vi.fn(),
  onSelectPack: vi.fn(),
  onSelectTier: vi.fn(),
  onSelectCustomLetters: vi.fn(),
  onSetGuidedCourseActive: vi.fn(),
}

describe('LearningSheet', () => {
  it('renders Course and Open practice segments', () => {
    render(<LearningSheet {...baseProps} />)
    expect(screen.getByRole('tab', { name: /course/i })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /open practice/i }),
    ).toBeInTheDocument()
  })

  it('starts on Course view when guidedCourseActive is true', () => {
    render(<LearningSheet {...baseProps} guidedCourseActive />)
    expect(screen.getByRole('button', { name: /pack 1\b/i })).toBeInTheDocument()
  })

  it('renders four tier rows in Open practice view', () => {
    render(<LearningSheet {...baseProps} />)
    expect(screen.getByRole('button', { name: /beginner letters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /common letters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /full alphabet adds b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /full alphabet \+ digits/i })).toBeInTheDocument()
  })

  it('calls onSetGuidedCourseActive(true) when switching to Course', () => {
    const onSetGuidedCourseActive = vi.fn()
    render(
      <LearningSheet
        {...baseProps}
        onSetGuidedCourseActive={onSetGuidedCourseActive}
      />,
    )
    screen.getByRole('tab', { name: /course/i }).click()
    expect(onSetGuidedCourseActive).toHaveBeenCalledWith(true)
  })

  it('calls onSetGuidedCourseActive(false) when switching to Open practice', () => {
    const onSetGuidedCourseActive = vi.fn()
    render(
      <LearningSheet
        {...baseProps}
        guidedCourseActive
        onSetGuidedCourseActive={onSetGuidedCourseActive}
      />,
    )
    screen.getByRole('tab', { name: /open practice/i }).click()
    expect(onSetGuidedCourseActive).toHaveBeenCalledWith(false)
  })

  it('fires onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<LearningSheet {...baseProps} onClose={onClose} />)
    screen.getByRole('button', { name: /^close$/i }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marks the current tier as selected when no custom letters', () => {
    render(<LearningSheet {...baseProps} maxLevel={2} />)
    const button = screen.getByRole('button', { name: /common letters/i })
    expect(button.className).toContain('is-selected')
  })

  it('does not mark any tier when custom letters are set', () => {
    render(
      <LearningSheet {...baseProps} maxLevel={2} customLetters={['A', 'B']} />,
    )
    const button = screen.getByRole('button', { name: /common letters/i })
    expect(button.className).not.toContain('is-selected')
  })

  it('calls onSelectTier and onClose when a tier is chosen', () => {
    const onSelectTier = vi.fn()
    const onClose = vi.fn()
    render(
      <LearningSheet
        {...baseProps}
        onSelectTier={onSelectTier}
        onClose={onClose}
      />,
    )
    screen.getByRole('button', { name: /full alphabet \+ digits/i }).click()
    expect(onSelectTier).toHaveBeenCalledWith(4)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the Pick your own row with selected count', () => {
    render(<LearningSheet {...baseProps} customLetters={['A', 'B', 'C']} />)
    expect(
      screen.getByRole('button', { name: /pick your own/i }),
    ).toHaveTextContent(/3 characters selected/i)
  })

  it('lists all 14 beginner course packs in Course view', () => {
    render(<LearningSheet {...baseProps} guidedCourseActive />)
    expect(screen.getByRole('button', { name: /pack 1\b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pack 14\b/i })).toBeInTheDocument()
  })

  it('marks completed packs in Course view', () => {
    render(
      <LearningSheet
        {...baseProps}
        guidedCourseActive
        guidedMaxPackReached={3}
      />,
    )
    const pack1 = screen.getByRole('button', { name: /pack 1\b/i })
    const pack4 = screen.getByRole('button', { name: /pack 4\b/i })
    expect(pack1.className).toContain('is-completed')
    expect(pack4.className).not.toContain('is-completed')
  })

  it('calls onSelectPack and onClose when a pack is chosen', () => {
    const onSelectPack = vi.fn()
    const onClose = vi.fn()
    render(
      <LearningSheet
        {...baseProps}
        guidedCourseActive
        onSelectPack={onSelectPack}
        onClose={onClose}
      />,
    )
    screen.getByRole('button', { name: /pack 5\b/i }).click()
    expect(onSelectPack).toHaveBeenCalledWith(4)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens Pick your own grid and toggles characters', () => {
    render(<LearningSheet {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /pick your own/i }))
    const aChip = screen.getByRole('button', { name: 'A', pressed: false })
    fireEvent.click(aChip)
    expect(
      screen.getByRole('button', { name: 'A', pressed: true }),
    ).toBeInTheDocument()
  })

  it('Apply persists draft selection and dismisses', () => {
    const onSelectCustomLetters = vi.fn()
    const onClose = vi.fn()
    render(
      <LearningSheet
        {...baseProps}
        customLetters={['A', 'E']}
        onSelectCustomLetters={onSelectCustomLetters}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /pick your own/i }))
    fireEvent.click(screen.getByRole('button', { name: 'B', pressed: false }))
    fireEvent.click(screen.getByRole('button', { name: 'A', pressed: true }))
    screen.getByRole('button', { name: /^apply$/i }).click()

    expect(onSelectCustomLetters).toHaveBeenCalledTimes(1)
    const arg = onSelectCustomLetters.mock.calls[0][0]
    expect(arg).toContain('B')
    expect(arg).toContain('E')
    expect(arg).not.toContain('A')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Apply is disabled when no characters are selected', () => {
    render(<LearningSheet {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /pick your own/i }))
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeDisabled()
  })
})
