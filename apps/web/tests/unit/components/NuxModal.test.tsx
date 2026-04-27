import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NuxModal } from '../../../src/components/NuxModal'

const baseProps = {
  step: 'welcome' as const,
  learnerProfile: null,
  soundChecked: false,
  tutorialTapCount: 0,
  tutorialHoldCount: 0,
  currentPack: [] as readonly string[],
  morseButton: null,
  onWelcomeDone: vi.fn(),
  onChooseProfile: vi.fn(),
  onPlaySoundCheck: vi.fn(),
  onContinueFromSoundCheck: vi.fn(),
  onCompleteButtonTutorial: vi.fn(),
  onFinishKnownTour: vi.fn(),
  onContinueFromStages: vi.fn(),
  onStartBeginnerCourse: vi.fn(),
  onSkipReminder: vi.fn(),
  onRequestSignIn: vi.fn(),
}

describe('NuxModal welcome screen', () => {
  it('renders Sign in / Stay signed out after 2s when user is null', () => {
    vi.useFakeTimers()
    const onRequestSignIn = vi.fn()
    render(
      <NuxModal
        {...baseProps}
        user={null}
        onRequestSignIn={onRequestSignIn}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stay signed out/i })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('hides the fork when user is signed in (replay scenario)', () => {
    vi.useFakeTimers()
    render(
      <NuxModal
        {...baseProps}
        user={{ uid: 'abc' }}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull()
    vi.useRealTimers()
  })
})
