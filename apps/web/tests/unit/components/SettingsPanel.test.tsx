import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '../../../src/components/SettingsPanel'
import type { SettingsPanelProps } from '../../../src/components/componentProps'

const baseProps: SettingsPanelProps = {
  freestyleWordMode: false,
  isFreestyle: false,
  isListen: false,
  levels: [1, 2, 3],
  listenWpm: 20,
  listenWpmMax: 30,
  listenWpmMin: 10,
  maxLevel: 2,
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
  onListenWpmChange: vi.fn(),
  onMaxLevelChange: vi.fn(),
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
  onSignIn: vi.fn(),
  onSignOut: vi.fn(),
}

describe('SettingsPanel', () => {
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

  it('omits Practice toggles in Freestyle mode', () => {
    render(<SettingsPanel {...baseProps} isFreestyle />)

    expect(
      screen.queryByRole('checkbox', { name: /auto-play sound/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('checkbox', { name: /immediate flow recovery/i }),
    ).toBeNull()
  })
})
