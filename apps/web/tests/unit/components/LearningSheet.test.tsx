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

  it('starts on Open practice when guidedCourseActive is false', () => {
    render(<LearningSheet {...baseProps} />)
    expect(screen.getByTestId('learning-open-placeholder')).toBeInTheDocument()
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
})
