import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListenControls } from '../../../src/components/ListenControls';

describe('ListenControls', () => {
  it('submits keyboard answers when custom keyboard is enabled', async () => {
    const onReplay = vi.fn();
    const onSubmitAnswer = vi.fn();
    const user = userEvent.setup();

    render(
      <ListenControls
        listenStatus="idle"
        onReplay={onReplay}
        onSubmitAnswer={onSubmitAnswer}
        useCustomKeyboard
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(onReplay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Type A' }));
    expect(onSubmitAnswer).toHaveBeenCalledWith('A');
  });

  it('hides the keyboard when custom keyboard is disabled', () => {
    render(
      <ListenControls
        listenStatus="idle"
        onReplay={vi.fn()}
        onSubmitAnswer={vi.fn()}
        useCustomKeyboard={false}
      />,
    );

    expect(
      screen.queryByRole('group', { name: 'Keyboard' }),
    ).not.toBeInTheDocument();
  });
});
