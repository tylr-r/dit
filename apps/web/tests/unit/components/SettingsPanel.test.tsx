import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '../../../src/components/SettingsPanel'
import type { SettingsPanelProps } from '../../../src/components/componentProps'

const baseProps: SettingsPanelProps = {
  freestyleWordMode: false,
  isFreestyle: false,
  isListen: false,
  isPractice: false,
  listenWpm: 20,
  listenWpmMax: 30,
  listenWpmMin: 10,
  practiceWordMode: false,
  practiceAutoPlay: true,
  practiceLearnMode: true,
  practiceIfrMode: false,
  practiceReviewMisses: false,
  guidedCourseActive: false,
  onPracticeAutoPlayChange: vi.fn(),
  onPracticeLearnModeChange: vi.fn(),
  onPracticeIfrModeChange: vi.fn(),
  onPracticeReviewMissesChange: vi.fn(),
  onUseRecommended: vi.fn(),
  onShowLearning: vi.fn(),
  onListenWpmChange: vi.fn(),
  onPracticeWordModeChange: vi.fn(),
  onShowAbout: vi.fn(),
  onShowHintChange: vi.fn(),
  onShowMnemonicChange: vi.fn(),
  onSoundCheck: vi.fn(),
  onWordModeChange: vi.fn(),
  showHint: true,
  showMnemonic: false,
  soundCheckStatus: 'idle',
  user: null,
  userLabel: 'Guest',
  userInitial: 'G',
  authReady: true,
  onShowSignIn: vi.fn(),
  onDeleteAccount: vi.fn(),
  isDeletingAccount: false,
  onSignOut: vi.fn(),
  onClose: vi.fn(),
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    window.gtag = vi.fn()
  })
  afterEach(() => {
    delete window.gtag
  })

  describe('modal shell', () => {
    it('renders a dialog with title "Settings" and a close button', () => {
      render(<SettingsPanel {...baseProps} />)
      expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /close settings/i })).toBeInTheDocument()
    })

    it('fires onClose when the close button is clicked', () => {
      const onClose = vi.fn()
      render(<SettingsPanel {...baseProps} onClose={onClose} />)
      screen.getByRole('button', { name: /close settings/i }).click()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('fires onClose when Escape is pressed', () => {
      const onClose = vi.fn()
      render(<SettingsPanel {...baseProps} onClose={onClose} />)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('fires onClose when the backdrop is clicked', () => {
      const onClose = vi.fn()
      const { container } = render(<SettingsPanel {...baseProps} onClose={onClose} />)
      const backdrop = container.querySelector('.settings-modal-backdrop')
      expect(backdrop).not.toBeNull()
      fireEvent.click(backdrop!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('disables hint toggles in freestyle mode', () => {
    render(<SettingsPanel {...baseProps} isFreestyle />)

    const showHints = screen.getByRole('checkbox', { name: /show hints/i })
    const showMnemonic = screen.getByRole('checkbox', {
      name: /show mnemonics/i,
    })

    expect(showHints).toBeDisabled()
    expect(showMnemonic).toBeDisabled()
  })

  it('disables sound check while playing', () => {
    render(
      <SettingsPanel
        {...baseProps}
        isListen
        soundCheckStatus="playing"
      />,
    )

    expect(
      screen.getByRole('button', { name: /sound check/i }),
    ).toBeDisabled()
  })

  it('renders the four Practice toggles outside Freestyle', () => {
    render(<SettingsPanel {...baseProps} />)

    expect(
      screen.getByRole('checkbox', { name: /auto-play sound/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /sequential order/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /immediate flow recovery/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /review misses later/i }),
    ).toBeInTheDocument()
  })

  it('hides Sequential order while the guided course is active', () => {
    render(<SettingsPanel {...baseProps} guidedCourseActive />)

    expect(
      screen.queryByRole('checkbox', { name: /sequential order/i }),
    ).toBeNull()
  })

  it('disables Sequential order while Practice Words is on', () => {
    render(<SettingsPanel {...baseProps} practiceWordMode />)

    expect(
      screen.getByRole('checkbox', { name: /sequential order/i }),
    ).toBeDisabled()
  })

  it('disables Review misses later when IFR is off', () => {
    render(<SettingsPanel {...baseProps} practiceIfrMode={false} />)

    expect(
      screen.getByRole('checkbox', { name: /review misses later/i }),
    ).toBeDisabled()
  })

  it('shows Practice toggles in Freestyle mode with a "Applies when…" helper', () => {
    render(<SettingsPanel {...baseProps} isPractice={false} isFreestyle />)
    expect(
      screen.getByRole('checkbox', { name: /auto-play sound/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/applies when you switch back to practice mode/i),
    ).toBeInTheDocument()
  })

  it('renders Use recommended settings and fires its callback', () => {
    const onUseRecommended = vi.fn()
    render(<SettingsPanel {...baseProps} onUseRecommended={onUseRecommended} />)

    const button = screen.getByRole('button', { name: /use recommended settings/i })
    button.click()

    expect(onUseRecommended).toHaveBeenCalledTimes(1)
  })

  it('renders Replay onboarding only when onReplayNux is provided', () => {
    const onReplayNux = vi.fn()
    const { rerender } = render(<SettingsPanel {...baseProps} />)

    expect(
      screen.queryByRole('button', { name: /replay onboarding/i }),
    ).toBeNull()

    rerender(<SettingsPanel {...baseProps} onReplayNux={onReplayNux} />)

    const button = screen.getByRole('button', { name: /replay onboarding/i })
    button.click()
    expect(onReplayNux).toHaveBeenCalledTimes(1)
  })

  it('renders the Learning disclosure row and fires onShowLearning', () => {
    const onShowLearning = vi.fn()
    render(<SettingsPanel {...baseProps} onShowLearning={onShowLearning} />)

    const button = screen.getByRole('button', { name: /learning/i })
    expect(button).toHaveTextContent(/open practice/i)
    button.click()

    expect(onShowLearning).toHaveBeenCalledTimes(1)
  })

  it('shows "Course" in the Learning row when guided course is active', () => {
    render(<SettingsPanel {...baseProps} guidedCourseActive />)
    const button = screen.getByRole('button', { name: /learning/i })
    expect(button).toHaveTextContent(/course/i)
  })

  it('shows the Learning row in Freestyle mode', () => {
    render(<SettingsPanel {...baseProps} isPractice={false} isFreestyle />)
    expect(
      screen.getByRole('button', { name: /learning method/i }),
    ).toBeInTheDocument()
  })

  it('renders Sign in button when signed out', () => {
    render(<SettingsPanel {...baseProps} />)
    expect(
      screen.getByRole('button', { name: /^sign in$/i }),
    ).toBeInTheDocument()
  })

  it('fires onShowSignIn when Sign in is clicked', () => {
    const onShowSignIn = vi.fn()
    render(<SettingsPanel {...baseProps} onShowSignIn={onShowSignIn} />)
    screen.getByRole('button', { name: /^sign in$/i }).click()
    expect(onShowSignIn).toHaveBeenCalledTimes(1)
  })

  it('renders Sign out and Delete account when signed in', () => {
    const user = { email: 'a@b.com', photoURL: null } as unknown as Parameters<typeof SettingsPanel>[0]['user']
    render(<SettingsPanel {...baseProps} user={user} />)
    expect(screen.getByRole('button', { name: /^sign out$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete account$/i })).toBeInTheDocument()
  })

  it('shows "Deleting" and disables actions during deletion', () => {
    const user = { email: 'a@b.com', photoURL: null } as unknown as Parameters<typeof SettingsPanel>[0]['user']
    render(
      <SettingsPanel {...baseProps} user={user} isDeletingAccount />,
    )
    screen.getAllByRole('button', { name: /deleting/i }).forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('requires confirmation before firing onDeleteAccount', () => {
    const onDeleteAccount = vi.fn()
    render(
      <SettingsPanel
        {...baseProps}
        user={{ uid: 'u1', email: 'a@b.c' } as unknown as Parameters<typeof SettingsPanel>[0]['user']}
        onDeleteAccount={onDeleteAccount}
      />,
    )
    // First click shows the confirm strip
    fireEvent.click(screen.getByRole('button', { name: /^delete account$/i }))
    expect(onDeleteAccount).not.toHaveBeenCalled()
    expect(
      screen.getByText(/permanently delete your account/i),
    ).toBeInTheDocument()

    // Second click confirms — there are now multiple "Delete account" buttons
    // (the original is replaced by the confirm strip's destructive button).
    fireEvent.click(screen.getAllByRole('button', { name: /^delete account$/i })[0])
    expect(onDeleteAccount).toHaveBeenCalledTimes(1)
  })

  it('cancel button reverts the delete confirm without firing', () => {
    const onDeleteAccount = vi.fn()
    render(
      <SettingsPanel
        {...baseProps}
        user={{ uid: 'u1', email: 'a@b.c' } as unknown as Parameters<typeof SettingsPanel>[0]['user']}
        onDeleteAccount={onDeleteAccount}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^delete account$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onDeleteAccount).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /^delete account$/i }),
    ).toBeInTheDocument()
  })
})
