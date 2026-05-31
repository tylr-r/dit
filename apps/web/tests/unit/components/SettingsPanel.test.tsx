import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '../../../src/components/SettingsPanel'
import type { SettingsPanelProps } from '../../../src/components/componentProps'

const makeProps = (
  overrides: Partial<SettingsPanelProps> = {},
): SettingsPanelProps => ({
  authReady: true,
  freestyleWordMode: false,
  guidedCourseActive: false,
  isDeletingAccount: false,
  isFreestyle: false,
  isListen: false,
  isPractice: true,
  listenWpm: 18,
  listenWpmMax: 40,
  listenWpmMin: 5,
  onClose: vi.fn(),
  onDeleteAccount: vi.fn(),
  onListenWpmChange: vi.fn(),
  onPracticeAutoPlayChange: vi.fn(),
  onPracticeIfrModeChange: vi.fn(),
  onPracticeLearnModeChange: vi.fn(),
  onPracticeReviewMissesChange: vi.fn(),
  onPracticeWordModeChange: vi.fn(),
  onShowAbout: vi.fn(),
  onShowHintChange: vi.fn(),
  onShowLearning: vi.fn(),
  onShowMnemonicChange: vi.fn(),
  onShowSignIn: vi.fn(),
  onSignOut: vi.fn(),
  onSoundCheck: vi.fn(),
  onToneFrequencyChange: vi.fn(),
  onResetApp: vi.fn(),
  onUseRecommended: vi.fn(),
  onWordModeChange: vi.fn(),
  practiceAutoPlay: true,
  practiceIfrMode: true,
  practiceLearnMode: false,
  practiceReviewMisses: false,
  practiceWordMode: false,
  showHint: false,
  showMnemonic: false,
  soundCheckStatus: 'idle',
  toneFrequency: 650,
  toneFrequencyMax: 1000,
  toneFrequencyMin: 300,
  toneFrequencyStep: 10,
  user: null,
  userInitial: '',
  userLabel: '',
  ...overrides,
})

describe('SettingsPanel', () => {
  it('disables immediate flow recovery while a guided course practice is active', async () => {
    const user = userEvent.setup()
    const onPracticeIfrModeChange = vi.fn()

    render(
      <SettingsPanel
        {...makeProps({
          guidedCourseActive: true,
          onPracticeIfrModeChange,
        })}
      />,
    )

    const toggle = screen.getByLabelText('Immediate flow recovery')
    expect(toggle).toBeDisabled()

    await user.click(toggle)
    expect(onPracticeIfrModeChange).not.toHaveBeenCalled()
  })

  it('disables recommended settings while a guided course is active', async () => {
    const user = userEvent.setup()
    const onUseRecommended = vi.fn()

    render(
      <SettingsPanel
        {...makeProps({
          guidedCourseActive: true,
          onUseRecommended,
        })}
      />,
    )

    const button = screen.getByRole('button', {
      name: /use recommended settings/i,
    })
    expect(button).toBeDisabled()

    await user.click(button)
    expect(onUseRecommended).not.toHaveBeenCalled()
  })

  it('shows Reset App when signed out', async () => {
    const user = userEvent.setup()
    const onResetApp = vi.fn()

    render(
      <SettingsPanel
        {...makeProps({
          onResetApp,
          user: null,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /reset app/i }))
    expect(onResetApp).toHaveBeenCalledTimes(1)
  })
})
