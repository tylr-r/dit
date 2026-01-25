import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../../../src/components/SettingsPanel';
import type { SettingsPanelProps } from '../../../src/components/componentProps';

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
  onListenWpmChange: vi.fn(),
  onMaxLevelChange: vi.fn(),
  onPracticeWordModeChange: vi.fn(),
  onShowHintChange: vi.fn(),
  onShowMnemonicChange: vi.fn(),
  onShowReference: vi.fn(),
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
};

describe('SettingsPanel', () => {
  it('disables hint toggles in freestyle mode', () => {
    render(<SettingsPanel {...baseProps} isFreestyle />);

    const showHints = screen.getByRole('checkbox', { name: /show hints/i });
    const showMnemonic = screen.getByRole('checkbox', {
      name: /show mnemonics/i,
    });

    expect(showHints).toBeDisabled();
    expect(showMnemonic).toBeDisabled();
  });

  it('disables sound check while playing', () => {
    render(
      <SettingsPanel
        {...baseProps}
        isListen
        soundCheckStatus="playing"
      />,
    );

    expect(
      screen.getByRole('button', { name: /sound check/i }),
    ).toBeDisabled();
  });
});
