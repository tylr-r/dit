import { render, screen } from '@testing-library/react'
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
    expect(screen.getByTestId('learning-course-placeholder')).toBeInTheDocument()
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
})
